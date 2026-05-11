# mcp-security-addon — Dockerfile
# Bundles Node.js + all commonly used security CLI tools
FROM kalilinux/kali-last-release:latest AS base

# ── System tools ────────────────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git unzip \
    # Nmap & Masscan
    nmap masscan \
    # DNS / network utilities
    dnsutils iputils-ping \
    # SSL scan
    sslscan \
    # Python ecosystem (sqlmap, scoutsuite, arjun)
    python3 python3-pip python3-venv \
    # Node.js will be installed below
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ──────────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs && apt-get clean

# ── Go tools ────────────────────────────────────────────────────────────────────
ENV GOPATH=/root/go
ENV PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

RUN curl -fsSL https://go.dev/dl/go1.22.3.linux-amd64.tar.gz | tar -C /usr/local -xzf - \
    && go install github.com/tomnomnom/assetfinder@latest \
    && go install github.com/tomnomnom/waybackurls@latest \
    && go install github.com/projectdiscovery/httpx/cmd/httpx@latest \
    && go install github.com/projectdiscovery/katana/cmd/katana@latest \
    && go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest \
    && go install github.com/projectdiscovery/ffuf/v2@latest \
    && go install github.com/sensepost/gowitness@latest

# ── Python tools ────────────────────────────────────────────────────────────────
RUN pip3 install --no-cache-dir \
    sqlmap \
    arjun

# ── Ruby tools ──────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends ruby ruby-dev make gcc && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    gem install wpscan --no-document

# ── Amass ───────────────────────────────────────────────────────────────────────
RUN go install github.com/owasp-amass/amass/v4/...@latest

# ── Node.js application ─────────────────────────────────────────────────────────
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY dist/ ./dist/

ENTRYPOINT ["node", "dist/index.js"]
