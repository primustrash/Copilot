# Copilot Agent Launcher – abgesicherter Entwicklungsstand

Dieser Agent Launcher liegt unter `copilot_agent/` und ist **nicht**
gleichbedeutend mit den GitHub-Copilot-Agentendefinitionen im Root-README.

## Aufruf und Freigaben

```sh
python3 -m pip install -r requirements.txt
export COPILOT_AGENT_WORKSPACE=/pfad/zu/einem/separaten/autorisierten-projekt
python3 -m copilot_agent
```

Ein GitHub-Zugang wird nur über den unterstützten GitHub-Client beziehungsweise
eine Umgebungsvariable bereitgestellt. Niemals echte Tokens in README, Git,
Ausgaben oder Modellnachrichten kopieren.

Jeder Modell-Toolaufruf einschließlich `file_read` wird nur dann ausgeführt,
wenn das lokale Terminal interaktiv ist, der gewünschte Toolname ausgewählt
wurde und der Betreiber die **exakten angezeigten Argumente** mit
`APPROVE` bestätigt. Nichtinteraktive Vorgänge werden verweigert.
Genehmigungen gelten jeweils nur für einen Aufruf.

`shell_exec` erlaubt nur wenige fest vorgegebene lesende Kommandos.
`git_operations` akzeptiert ausschließlich lesende Varianten von Status,
Diff und Log. Python-Ausführung benötigt Bubblewrap und `prlimit` und muss
in einem isolierten Netzwerk-/Prozess-Namespace stattfinden. Fehlt diese
Betriebssystemisolation, wird die Ausführung verweigert.

## Abnahmelimits

Die Unit-Suite und CI belegen noch **nicht** den erfolgreichen Start der
Isolation unter allen Linux-Distributionen, die Kompatibilität mit dem
jeweils ausgewählten GitHub-Modell, reale GitHub-OAuth-Interaktion oder eine
vollständige produktive Tool-Calling-Sitzung. Kein allgemeines Admin- oder
Schreibrecht ohne individuelle Aktionserlaubnis.

Der gesperrte Alt-PR #1 bleibt erhalten. Dieser Entwicklungsstand gehört zum
Nachfolge-PR #11; eine Schließung des alten PRs erfolgt erst nach sicherer
Übernahme und regulärer Prüfung des Nachfolgers.
