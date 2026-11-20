# TP-Link RE300: sichere Firmware-Bestandsaufnahme

Dieses Repository beschreibt eine **nicht-flashende** Vorprüfung für offizielle
RE300-Firmware. Es bestätigt **keine** Gerätekompatibilität und installiert nichts.

## Dateien

- `docs/re300_firmware_plan_de.md`: technische Sicherheits- und Recovery-Checkliste
- `scripts/verify_tp_link_firmware.sh`: Shell-Einstieg mit Pflicht-Hash
- `scripts/safe_verify_firmware_zip.py`: ZIP-Integritäts- und Extraktionsprüfung
- `tests/test_safe_firmware_zip.py`: Sicherheitsregressionen

## Voraussetzungen

Firmware ausschließlich über eine authentifizierte Herstellerquelle beziehen.
Den **vertrauenswürdigen SHA-256-Wert unabhängig von der heruntergeladenen
ZIP-Datei** beziehen, z. B. aus einer signierten Herstellermitteilung. Der lokal
berechnete Wert allein beweist nicht die Echtheit.

## Beispiel (keine Flashaktion)

```sh
bash scripts/verify_tp_link_firmware.sh /pfad/firmware.zip VERTRAUENSWUERDIGER_SHA256_HEXWERT /pfad/neuer_extraktionsordner
```

Das Programm verweigert den Vorgang bei fehlendem/falschem Herstellerhash,
unsicheren ZIP-Einträgen oder einem vorhandenen Zielverzeichnis. Das Ergebnis
enthält ausdrücklich `hardware_compatibility_verified=false` und
`flash_permitted=false`. Für Board-ID, Revision, Signatur und Recovery ist
zusätzliche gerätespezifische Prüfung erforderlich.
