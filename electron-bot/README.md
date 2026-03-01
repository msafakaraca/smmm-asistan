# SMMM Bot - Electron App

Standalone bot uygulaması. Mali müşavirlerin bilgisayarlarında çalışarak GİB/TÜRMOB işlemlerini gerçekleştirir.

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

## Build

```bash
npm run dist
```

## Mimari

- **Main Process**: Pencere yönetimi, WebSocket client, SQLite
- **Renderer**: React UI (Login + Status)
- **Bots**: Puppeteer tabanlı headless botlar
