#!/usr/bin/env python3
"""
OpenAI Token Tracker
Ein Windows-Programm zur Überwachung von Token- und Kreditnutzung
über mehrere OpenAI-Konten hinweg.
"""

import customtkinter as ctk
from tkinter import messagebox
import requests
import json
import threading
import os
import math
import webbrowser
import hashlib
import base64
import secrets
import socket
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
import calendar
import uuid

# ============================================================
# Konfiguration
# ============================================================

APP_TITLE = "OpenAI Token Tracker"
APP_VERSION = "1.0.0"

CONFIG_DIR = Path.home() / ".openai_tracker"
CONFIG_FILE = CONFIG_DIR / "accounts.json"

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Farben
C_BG       = "#12122a"
C_CARD     = "#1a1a3e"
C_CARD2    = "#20205a"
C_ACCENT   = "#3a3aaa"
C_GREEN    = "#00c896"
C_YELLOW   = "#f9c846"
C_RED      = "#e74c3c"
C_TEXT     = "#e8e8ff"
C_SUBTEXT  = "#8888bb"
C_BORDER   = "#2a2a6a"

# ============================================================
# OpenAI API Client
# ============================================================

class OpenAIClient:
    BASE_URL = "https://api.openai.com/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: dict = None, timeout: int = 15):
        r = requests.get(
            f"{self.BASE_URL}{path}",
            headers=self.headers,
            params=params,
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()

    def get_subscription(self) -> dict:
        return self._get("/billing/subscription")

    def get_billing_usage(self, start_date: str, end_date: str) -> dict:
        return self._get("/billing/usage", {"start_date": start_date, "end_date": end_date})

    def get_org_usage_completions(self, start_time: int, end_time: int) -> dict | None:
        try:
            return self._get(
                "/organization/usage/completions",
                {"start_time": start_time, "end_time": end_time, "limit": 1000},
            )
        except Exception:
            return None

    def get_credit_grants(self) -> dict | None:
        try:
            r = requests.get(
                "https://api.openai.com/dashboard/billing/credit_grants",
                headers=self.headers,
                timeout=15,
            )
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        return None

    def verify(self) -> bool:
        self._get("/models")
        return True


# ============================================================
# Account-Verwaltung
# ============================================================

class AccountManager:
    def __init__(self):
        self.accounts: list[dict] = []
        self._load()

    def _load(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    self.accounts = json.load(f)
            except Exception:
                self.accounts = []

    def _save(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.accounts, f, indent=2, ensure_ascii=False)

    def add(self, name: str, api_key: str) -> dict:
        for a in self.accounts:
            if a["api_key"] == api_key:
                raise ValueError("Dieser API-Key ist bereits vorhanden.")
        account = {
            "id": str(uuid.uuid4()),
            "name": name,
            "api_key": api_key,
        }
        self.accounts.append(account)
        self._save()
        return account

    def remove(self, account_id: str):
        self.accounts = [a for a in self.accounts if a["id"] != account_id]
        self._save()

    def all(self) -> list[dict]:
        return list(self.accounts)


# ============================================================
# Datenabruf
# ============================================================

class AccountFetcher:
    def fetch(self, account: dict) -> dict:
        result = {
            "account": account,
            "status": "error",
            "error": None,
            "subscription": None,
            "billing_usage": None,
            "credits": None,
            "token_usage": None,
        }
        try:
            client = OpenAIClient(account["api_key"])

            # Abonnement-Info
            try:
                result["subscription"] = client.get_subscription()
            except requests.HTTPError as e:
                if e.response.status_code not in (403, 404):
                    raise

            # Abrechnungsnutzung (aktueller Monat)
            try:
                today = date.today()
                start = today.replace(day=1).strftime("%Y-%m-%d")
                end = today.strftime("%Y-%m-%d")
                result["billing_usage"] = client.get_billing_usage(start, end)
            except Exception:
                pass

            # Kredit-Guthaben
            result["credits"] = client.get_credit_grants()

            # Token-Nutzung (neuer Endpunkt)
            try:
                now_ts = int(datetime.now().timestamp())
                month_start = int(
                    datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp()
                )
                result["token_usage"] = client.get_org_usage_completions(month_start, now_ts)
            except Exception:
                pass

            result["status"] = "success"

        except requests.HTTPError as e:
            code = e.response.status_code
            if code == 401:
                result["error"] = "Ungültiger API-Key (401)"
            elif code == 429:
                result["error"] = "Zu viele Anfragen – bitte warten (429)"
            else:
                result["error"] = f"API-Fehler {code}"
        except requests.ConnectionError:
            result["error"] = "Keine Internetverbindung"
        except Exception as e:
            result["error"] = str(e)
        return result


# ============================================================
# OAuth 2.0 PKCE Authentifizierung
# ============================================================

_OAUTH_SUCCESS_HTML = (
    b"<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;"
    b"padding-top:80px;background:#12122a;color:#e8e8ff'>"
    b"<h2 style='color:#00c896'>&#10003; Authentifizierung erfolgreich!</h2>"
    b"<p>Du kannst dieses Fenster jetzt schlie&szlig;en und zur App zur&uuml;ckkehren.</p>"
    b"</body></html>"
)

_OAUTH_ERROR_HTML = (
    b"<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;"
    b"padding-top:80px;background:#12122a;color:#e74c3c'>"
    b"<h2>Fehler bei der Authentifizierung</h2>"
    b"<p>Bitte schlie&szlig;e dieses Fenster und versuche es erneut.</p>"
    b"</body></html>"
)


class OAuthFlow:
    """OAuth 2.0 PKCE flow for OpenAI / Auth0 authentication."""

    AUTH_URL  = "https://auth.openai.com/authorize"
    TOKEN_URL = "https://auth.openai.com/oauth/token"
    SCOPES    = "openid profile email"

    def __init__(self, client_id: str):
        self.client_id = client_id
        # PKCE
        self._verifier  = secrets.token_urlsafe(64)
        digest          = hashlib.sha256(self._verifier.encode()).digest()
        self._challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        self._state     = secrets.token_urlsafe(16)
        self._port      = self._free_port()
        self.redirect_uri = f"http://localhost:{self._port}/callback"

    # ── helpers ──────────────────────────────────────────────────
    @staticmethod
    def _free_port() -> int:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))  # bind only on loopback
            return s.getsockname()[1]

    @staticmethod
    def decode_jwt_payload(token: str) -> dict:
        """Decode JWT payload for display purposes only (no signature verification).
        The access_token itself – validated server-side by the API – grants API access.
        """
        try:
            part = token.split(".")[1]
            part += "=" * (-len(part) % 4)
            return json.loads(base64.urlsafe_b64decode(part))
        except Exception:
            return {}

    # ── public API ───────────────────────────────────────────────
    def auth_url(self) -> str:
        params = urllib.parse.urlencode({
            "response_type":         "code",
            "client_id":             self.client_id,
            "redirect_uri":          self.redirect_uri,
            "scope":                 self.SCOPES,
            "code_challenge":        self._challenge,
            "code_challenge_method": "S256",
            "state":                 self._state,
        })
        return f"{self.AUTH_URL}?{params}"

    def exchange_code(self, code: str) -> dict:
        r = requests.post(
            self.TOKEN_URL,
            data={
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  self.redirect_uri,
                "client_id":     self.client_id,
                "code_verifier": self._verifier,
            },
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def start_callback_server(self, on_result):
        """Start a one-shot local HTTP server that captures the OAuth redirect."""
        flow = self

        class _Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                if "code" in qs:
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(_OAUTH_SUCCESS_HTML)
                    threading.Thread(
                        target=lambda: on_result(qs["code"][0], None), daemon=True
                    ).start()
                else:
                    error_parts = qs.get("error_description") or qs.get("error") or ["Unbekannter Fehler"]
                    err = error_parts[0]
                    self.send_response(400)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(_OAUTH_ERROR_HTML)
                    threading.Thread(
                        target=lambda: on_result(None, err), daemon=True
                    ).start()

            def log_message(self, *_):
                pass  # suppress server log output

        server = HTTPServer(("localhost", flow._port), _Handler)
        server.timeout = 3 * 60  # 3-minute window for user to complete login
        threading.Thread(target=server.handle_request, daemon=True).start()
        return server


# ============================================================
# Kreisförmige Fortschrittsanzeige
# ============================================================

class CircularProgress(ctk.CTkCanvas):
    def __init__(self, parent, size: int = 100, thickness: int = 10, **kw):
        super().__init__(
            parent, width=size, height=size,
            bg=C_CARD, highlightthickness=0, **kw
        )
        self.size = size
        self.thickness = thickness
        self._draw(0.0, C_SUBTEXT, "–")

    def set_value(self, ratio: float, label: str = ""):
        ratio = max(0.0, min(1.0, ratio))
        if ratio > 0.5:
            color = C_GREEN
        elif ratio > 0.2:
            color = C_YELLOW
        else:
            color = C_RED
        self._draw(ratio, color, label)

    def _draw(self, ratio: float, color: str, center_text: str):
        self.delete("all")
        pad = self.thickness + 4
        x0, y0 = pad, pad
        x1, y1 = self.size - pad, self.size - pad

        # Hintergrundring
        self.create_arc(x0, y0, x1, y1, start=90, extent=360,
                        outline=C_BORDER, width=self.thickness, style="arc")
        # Fortschritt
        if ratio > 0.001:
            self.create_arc(x0, y0, x1, y1, start=90, extent=-(ratio * 360),
                            outline=color, width=self.thickness, style="arc")
        # Text
        cx, cy = self.size // 2, self.size // 2
        self.create_text(cx, cy, text=center_text,
                         fill=C_TEXT, font=("Segoe UI", 13, "bold"))


# ============================================================
# Konto-Karte
# ============================================================

class AccountCard(ctk.CTkFrame):
    def __init__(self, parent, data: dict, on_remove, **kw):
        super().__init__(parent, corner_radius=14, fg_color=C_CARD,
                         border_color=C_BORDER, border_width=1, **kw)
        self._data = data
        self._on_remove = on_remove
        self._build()

    # ── Layout-Helfer ──────────────────────────────────────
    def _lbl(self, parent, text, size=12, bold=False, color=C_TEXT, **kw):
        weight = "bold" if bold else "normal"
        return ctk.CTkLabel(parent, text=text, text_color=color,
                            font=ctk.CTkFont(family="Segoe UI", size=size, weight=weight), **kw)

    def _build(self):
        account = self._data.get("account", {})
        status  = self._data.get("status", "loading")
        error   = self._data.get("error")

        # ── Kopfzeile ──────────────────────────────────────
        head = ctk.CTkFrame(self, fg_color=C_CARD2, corner_radius=10)
        head.pack(fill="x", padx=10, pady=(10, 0))

        self._lbl(head, f"  {account.get('name', 'Unbekannt')}",
                  size=15, bold=True).pack(side="left", pady=8)

        ctk.CTkButton(
            head, text="✕", width=28, height=28,
            fg_color=C_BORDER, hover_color=C_RED,
            font=ctk.CTkFont(size=11),
            command=lambda: self._on_remove(account["id"]),
        ).pack(side="right", padx=8, pady=8)

        # ── Statusanzeige ──────────────────────────────────
        if status == "loading":
            self._lbl(self, "⟳  Daten werden geladen …",
                      color=C_SUBTEXT, size=13).pack(pady=25)
            return
        if status == "error":
            self._lbl(self, f"⚠  {error}", color=C_RED, size=13).pack(pady=25)
            return

        # ── Hauptinhalt ────────────────────────────────────
        body = ctk.CTkFrame(self, fg_color="transparent")
        body.pack(fill="x", padx=14, pady=10)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=0)

        left = ctk.CTkFrame(body, fg_color="transparent")
        left.grid(row=0, column=0, sticky="nw")

        sub     = self._data.get("subscription") or {}
        billing = self._data.get("billing_usage") or {}
        credits = self._data.get("credits") or {}

        # E-Mail / Name
        email = sub.get("customer_email", account.get("name", "N/A"))
        self._lbl(left, f"📧  {email}", color=C_SUBTEXT).pack(anchor="w", pady=1)

        # Abonnement-Typ
        plan_obj   = sub.get("plan", {})
        plan_title = (plan_obj.get("title") or plan_obj.get("id") or "N/A") if isinstance(plan_obj, dict) else str(plan_obj)
        self._lbl(left, f"📋  Plan:  {plan_title}", size=13, bold=True).pack(anchor="w", pady=2)

        # ── Kredit-Guthaben ────────────────────────────────
        total_granted = credits.get("total_granted", 0) or 0
        total_used    = credits.get("total_used", 0)    or 0
        total_avail   = credits.get("total_available", 0) or 0
        expires_at    = credits.get("expires_at")

        usage_cents  = billing.get("total_usage", 0) or 0
        usage_usd    = usage_cents / 100.0

        # Bevorzuge Credits-Endpunkt, Fallback: billing hard limit
        hard_limit = sub.get("hard_limit_usd") or 0

        if total_granted > 0:
            remaining  = total_avail
            total_cap  = total_granted
            used       = total_used
        elif hard_limit:
            remaining  = hard_limit - usage_usd
            total_cap  = hard_limit
            used       = usage_usd
        else:
            remaining  = None
            total_cap  = None
            used       = usage_usd

        # Verbrauch (Monat)
        self._lbl(left, f"📊  Verbrauch (akt. Monat):  ${used:.4f}",
                  color=C_SUBTEXT).pack(anchor="w", pady=1)

        # Verbleibendes Guthaben
        if total_cap and total_cap > 0:
            pct   = (remaining / total_cap) * 100
            r_fmt = f"${remaining:.4f}"
            t_fmt = f"${total_cap:.2f}"
            if pct > 30:
                rem_color = C_GREEN
            elif pct > 10:
                rem_color = C_YELLOW
            else:
                rem_color = C_RED

            self._lbl(
                left,
                f"✅  Verbleibend:  {r_fmt}  von  {t_fmt}  ({pct:.1f} %)",
                size=13, bold=True, color=rem_color,
            ).pack(anchor="w", pady=4)
        else:
            self._lbl(left, "💳  Kein Budgetlimit abrufbar", color=C_SUBTEXT).pack(anchor="w", pady=2)
            pct, remaining, total_cap = None, None, None

        # Soft-Limit
        soft_limit = sub.get("soft_limit_usd")
        if soft_limit:
            self._lbl(left, f"🔔  Benachrichtigung ab:  ${soft_limit:.2f}",
                      color=C_SUBTEXT, size=12).pack(anchor="w", pady=1)

        # Nächste Erneuerung
        reset_str = self._next_reset(sub, expires_at)
        self._lbl(left, f"🔄  Nächste Erneuerung:  {reset_str}",
                  color=C_SUBTEXT).pack(anchor="w", pady=1)

        # Token-Nutzung (neuer Endpunkt)
        token_data = self._data.get("token_usage")
        if token_data:
            items = token_data.get("data", [])
            total_tokens = sum(
                b.get("input_tokens", 0) + b.get("output_tokens", 0)
                for item in items for b in item.get("results", [item])
            )
            if total_tokens:
                self._lbl(left, f"🔢  Tokens (akt. Monat):  {total_tokens:,}",
                          color=C_SUBTEXT).pack(anchor="w", pady=1)

        # ── Kreisanzeige ───────────────────────────────────
        right = ctk.CTkFrame(body, fg_color="transparent")
        right.grid(row=0, column=1, sticky="ne", padx=(12, 0))

        circ = CircularProgress(right, size=96, thickness=9)
        circ.pack()

        if pct is not None:
            label = f"{pct:.0f}%"
            circ.set_value(pct / 100.0, label)
        else:
            circ.set_value(0.0, "?")

        self._lbl(right, "verbleibend", size=10, color=C_SUBTEXT).pack(pady=(2, 0))

    # ── Hilfsfunktionen ────────────────────────────────────
    @staticmethod
    def _next_reset(sub: dict, expires_at=None) -> str:
        # access_until Feld (Unix-Timestamp)
        access_until = sub.get("access_until")
        if access_until:
            try:
                return datetime.fromtimestamp(access_until, tz=timezone.utc).strftime("%d.%m.%Y")
            except Exception:
                pass
        # expires_at aus credits
        if expires_at:
            try:
                return datetime.fromtimestamp(expires_at, tz=timezone.utc).strftime("%d.%m.%Y")
            except Exception:
                pass
        # Standard: Erster des nächsten Monats
        today = date.today()
        if today.month == 12:
            next_first = date(today.year + 1, 1, 1)
        else:
            next_first = date(today.year, today.month + 1, 1)
        return next_first.strftime("%d.%m.%Y")


# ============================================================
# Dialog: Konto hinzufügen  (API-Key  oder  Browser-Login)
# ============================================================

class AddAccountDialog(ctk.CTkToplevel):
    def __init__(self, parent, on_add):
        super().__init__(parent)
        self.on_add = on_add
        self.title("Konto hinzufügen")
        self.geometry("500x430")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=C_BG)
        self._oauth_flow: OAuthFlow | None = None
        self._build()

    # ── Layout-Helfer ──────────────────────────────────────
    def _lbl(self, parent, text, size=12, bold=False, color=C_SUBTEXT, **kw):
        weight = "bold" if bold else "normal"
        return ctk.CTkLabel(
            parent, text=text, text_color=color,
            font=ctk.CTkFont(family="Segoe UI", size=size, weight=weight), **kw
        )

    def _build(self):
        self._lbl(
            self, "OpenAI-Konto hinzufügen",
            size=16, bold=True, color=C_TEXT,
        ).pack(pady=(18, 8))

        tabs = ctk.CTkTabview(self, fg_color=C_CARD, segmented_button_fg_color=C_BORDER,
                              segmented_button_selected_color=C_ACCENT,
                              segmented_button_selected_hover_color="#5555cc",
                              segmented_button_unselected_color=C_BORDER,
                              segmented_button_unselected_hover_color=C_ACCENT)
        tabs.pack(fill="both", expand=True, padx=22, pady=(0, 16))

        tabs.add("🔑  API-Key")
        tabs.add("🌐  Browser-Login")

        self._build_apikey_tab(tabs.tab("🔑  API-Key"))
        self._build_oauth_tab(tabs.tab("🌐  Browser-Login"))

    # ── Tab 1: API-Key ─────────────────────────────────────
    def _build_apikey_tab(self, parent):
        pad = {"padx": 18}

        self._lbl(parent, "Anzeigename:").pack(anchor="w", pady=(14, 0), **pad)
        self._name_key = ctk.CTkEntry(
            parent, placeholder_text="z. B. Mein Pro-Konto", height=36)
        self._name_key.pack(fill="x", pady=(3, 10), **pad)

        self._lbl(parent, "API-Key  (sk-…):").pack(anchor="w", **pad)
        self._key = ctk.CTkEntry(
            parent, placeholder_text="sk-…", height=36, show="•")
        self._key.pack(fill="x", pady=(3, 4), **pad)

        self._show_var = ctk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            parent, text="API-Key anzeigen",
            variable=self._show_var, command=self._toggle_show,
            text_color=C_SUBTEXT, checkbox_width=18, checkbox_height=18,
        ).pack(anchor="w", pady=(0, 6), **pad)

        # Quick-link to OpenAI API keys page
        link = ctk.CTkButton(
            parent,
            text="🔗  platform.openai.com/api-keys  ↗",
            fg_color="transparent", hover_color=C_CARD2,
            text_color=C_SUBTEXT, font=ctk.CTkFont(size=11),
            anchor="w", height=22,
            command=lambda: webbrowser.open("https://platform.openai.com/api-keys"),
        )
        link.pack(anchor="w", padx=14, pady=(0, 10))

        btns = ctk.CTkFrame(parent, fg_color="transparent")
        btns.pack(fill="x", padx=18, pady=(4, 14))
        ctk.CTkButton(btns, text="Abbrechen", fg_color=C_BORDER,
                      hover_color=C_ACCENT, command=self.destroy).pack(
            side="left", expand=True, fill="x", padx=(0, 6))
        ctk.CTkButton(btns, text="Hinzufügen", fg_color=C_ACCENT,
                      hover_color="#5555cc", command=self._submit_apikey).pack(
            side="right", expand=True, fill="x", padx=(6, 0))

    def _toggle_show(self):
        self._key.configure(show="" if self._show_var.get() else "•")

    def _submit_apikey(self):
        name = self._name_key.get().strip()
        key  = self._key.get().strip()
        if not name:
            messagebox.showerror("Fehler", "Bitte einen Anzeigenamen eingeben.", parent=self)
            return
        if not key.startswith("sk-"):
            messagebox.showerror(
                "Fehler", "Bitte einen gültigen API-Key eingeben (beginnt mit 'sk-').",
                parent=self,
            )
            return
        self.on_add(name, key)
        self.destroy()

    # ── Tab 2: Browser-Login (OAuth PKCE) ──────────────────
    def _build_oauth_tab(self, parent):
        pad = {"padx": 18}

        self._lbl(parent, "Anzeigename  (optional, wird auto-befüllt):").pack(
            anchor="w", pady=(14, 0), **pad)
        self._name_oauth = ctk.CTkEntry(
            parent, placeholder_text="z. B. Mein ChatGPT-Pro", height=36)
        self._name_oauth.pack(fill="x", pady=(3, 10), **pad)

        self._lbl(parent, "OAuth Client-ID:").pack(anchor="w", **pad)
        self._client_id = ctk.CTkEntry(
            parent, placeholder_text="Deine OAuth App Client-ID", height=36)
        self._client_id.pack(fill="x", pady=(3, 4), **pad)

        link = ctk.CTkButton(
            parent,
            text="🔗  OAuth App registrieren  ↗",
            fg_color="transparent", hover_color=C_CARD2,
            text_color=C_SUBTEXT, font=ctk.CTkFont(size=11),
            anchor="w", height=22,
            command=lambda: webbrowser.open(
                "https://platform.openai.com/docs/authentication"
            ),
        )
        link.pack(anchor="w", padx=14, pady=(0, 10))

        self._oauth_status = self._lbl(
            parent, "Bereit – Klicke auf  \"Im Browser verbinden\".",
            size=11, color=C_SUBTEXT,
        )
        self._oauth_status.pack(anchor="w", pady=(0, 6), **pad)

        btns = ctk.CTkFrame(parent, fg_color="transparent")
        btns.pack(fill="x", padx=18, pady=(4, 14))
        ctk.CTkButton(btns, text="Abbrechen", fg_color=C_BORDER,
                      hover_color=C_ACCENT, command=self.destroy).pack(
            side="left", expand=True, fill="x", padx=(0, 6))
        self._oauth_btn = ctk.CTkButton(
            btns, text="🌐  Im Browser verbinden",
            fg_color=C_GREEN, hover_color="#00a87a", text_color="#000000",
            font=ctk.CTkFont(weight="bold"),
            command=self._start_oauth,
        )
        self._oauth_btn.pack(side="right", expand=True, fill="x", padx=(6, 0))

    def _start_oauth(self):
        client_id = self._client_id.get().strip()
        if not client_id:
            messagebox.showerror(
                "Fehler",
                "Bitte eine OAuth Client-ID eingeben.\n\n"
                "Du kannst eine OAuth-App unter platform.openai.com/docs/authentication "
                "registrieren.",
                parent=self,
            )
            return

        self._oauth_btn.configure(state="disabled", text="⟳  Warte …")
        self._oauth_status.configure(
            text="Öffne Browser … (Fenster nach Login automatisch schließen)",
            text_color=C_YELLOW,
        )

        self._oauth_flow = OAuthFlow(client_id)
        self._oauth_flow.start_callback_server(self._on_oauth_callback)
        webbrowser.open(self._oauth_flow.auth_url())

    def _on_oauth_callback(self, code: str | None, error: str | None):
        """Called from the callback server thread – must schedule UI changes on main thread."""
        if error:
            self.after(0, lambda: self._oauth_failed(error))
            return
        # Exchange the code for tokens in the background
        threading.Thread(
            target=self._exchange_oauth_code, args=(code,), daemon=True
        ).start()

    def _exchange_oauth_code(self, code: str):
        try:
            tokens = self._oauth_flow.exchange_code(code)
        except Exception as exc:
            self.after(0, lambda: self._oauth_failed(str(exc)))
            return

        access_token = tokens.get("access_token", "")
        id_token     = tokens.get("id_token", "")

        # Try to extract display name from id_token JWT payload
        display_name = self._name_oauth.get().strip()
        if not display_name and id_token:
            payload = OAuthFlow.decode_jwt_payload(id_token)
            display_name = (
                payload.get("name")
                or payload.get("email")
                or payload.get("sub", "OAuth-Konto")
            )

        if not display_name:
            display_name = "OAuth-Konto"

        self.after(0, lambda: self._oauth_success(display_name, access_token))

    def _oauth_success(self, name: str, token: str):
        self._oauth_status.configure(
            text=f"✅  Verbunden als: {name}", text_color=C_GREEN)
        self._oauth_btn.configure(state="normal", text="🌐  Im Browser verbinden")
        self.on_add(name, token)
        self.destroy()

    def _oauth_failed(self, error: str):
        self._oauth_status.configure(
            text=f"⚠  Fehler: {error}", text_color=C_RED)
        self._oauth_btn.configure(state="normal", text="🌐  Im Browser verbinden")


# ============================================================
# Hauptfenster
# ============================================================

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_TITLE}  v{APP_VERSION}")
        self.geometry("960x720")
        self.minsize(720, 500)
        self.configure(fg_color=C_BG)

        self._manager = AccountManager()
        self._fetcher = AccountFetcher()
        self._cache: dict[str, dict] = {}

        self._build_ui()
        self._refresh_all()

    # ── UI aufbauen ────────────────────────────────────────
    def _build_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # ── Header ────────────────────────────────────────
        hdr = ctk.CTkFrame(self, fg_color=C_CARD2, corner_radius=0, height=64)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_propagate(False)

        ctk.CTkLabel(
            hdr, text="🤖  OpenAI Token Tracker",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold"),
            text_color=C_TEXT,
        ).pack(side="left", padx=20)

        self._refresh_btn = ctk.CTkButton(
            hdr, text="🔄  Aktualisieren", width=145,
            fg_color=C_ACCENT, hover_color="#5555cc",
            command=self._refresh_all,
        )
        self._refresh_btn.pack(side="right", padx=(6, 16), pady=14)

        ctk.CTkButton(
            hdr, text="＋  Konto hinzufügen", width=165,
            fg_color=C_GREEN, hover_color="#00a87a", text_color="#000000",
            font=ctk.CTkFont(weight="bold"),
            command=self._add_account,
        ).pack(side="right", padx=(16, 0), pady=14)

        # ── Scrollbarer Bereich ───────────────────────────
        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color=C_BG,
            scrollbar_button_color=C_ACCENT,
            scrollbar_button_hover_color="#5555cc",
        )
        self._scroll.grid(row=1, column=0, sticky="nsew")
        self._scroll.columnconfigure(0, weight=1)

        self._render()

    # ── Karten rendern ────────────────────────────────────
    def _render(self):
        for w in self._scroll.winfo_children():
            w.destroy()

        accounts = self._manager.all()
        if not accounts:
            self._empty_state()
            return

        for acc in accounts:
            data = self._cache.get(acc["id"], {"account": acc, "status": "loading"})
            card = AccountCard(self._scroll, data=data, on_remove=self._remove_account)
            card.pack(fill="x", padx=22, pady=9)

    def _empty_state(self):
        frame = ctk.CTkFrame(self._scroll, fg_color="transparent")
        frame.pack(expand=True, pady=80)
        ctk.CTkLabel(frame, text="🤖", font=ctk.CTkFont(size=64)).pack()
        ctk.CTkLabel(
            frame, text="Keine Konten hinzugefügt",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
            text_color=C_TEXT,
        ).pack(pady=10)
        ctk.CTkLabel(
            frame,
            text='Klicke auf  "＋ Konto hinzufügen"  um ein OpenAI-Konto zu verknüpfen.',
            text_color=C_SUBTEXT,
            font=ctk.CTkFont(family="Segoe UI", size=13),
        ).pack()

    # ── Aktionen ──────────────────────────────────────────
    def _add_account(self):
        AddAccountDialog(self, self._on_account_added)

    def _on_account_added(self, name: str, key: str):
        try:
            self._manager.add(name, key)
            self._refresh_all()
        except ValueError as e:
            messagebox.showerror("Fehler", str(e))

    def _remove_account(self, account_id: str):
        if messagebox.askyesno("Konto entfernen", "Dieses Konto wirklich entfernen?"):
            self._manager.remove(account_id)
            self._cache.pop(account_id, None)
            self._render()

    def _refresh_all(self):
        accounts = self._manager.all()
        self._refresh_btn.configure(state="disabled", text="⟳  Lädt …")

        for acc in accounts:
            self._cache[acc["id"]] = {"account": acc, "status": "loading"}
        self._render()

        if not accounts:
            self._refresh_btn.configure(state="normal", text="🔄  Aktualisieren")
            return

        def _worker():
            for acc in accounts:
                result = self._fetcher.fetch(acc)
                self._cache[acc["id"]] = result
                self.after(0, self._render)
            self.after(0, lambda: self._refresh_btn.configure(
                state="normal", text="🔄  Aktualisieren"))

        threading.Thread(target=_worker, daemon=True).start()


# ============================================================
# Einstiegspunkt
# ============================================================

if __name__ == "__main__":
    app = App()
    app.mainloop()
