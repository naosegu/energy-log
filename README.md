# Energy Log

`Energy Log` は、日々の出来事を `🔋充電` と `⚡放電` で記録するための小さなログアプリです。

長文の日記ではなく、短く・軽く・続けやすい記録を目指して作りました。
AWS サーバレス構成の学習と実践を兼ねて、CRUD アプリとして実装しています。

## Tech Stack

- Frontend
  - HTML / CSS / JavaScript
  - S3
  - CloudFront
- Backend
  - API Gateway
  - Lambda (Node.js)
  - DynamoDB
- Infrastructure
  - AWS CDK
  - TypeScript

## Features

- `🔋充電 / ⚡放電` の2種類でログを記録
- 強さを3段階で記録
- 追加 / 編集 / 削除
- 今日の収支、7日平均、直近数日の流れを表示
- ログインなしで、同じブラウザなら継続利用可能

## Project Structure

```text
frontend/
  index.html
  style.css
  main.js

backend/
  functions/
    api/
      index.js

infra/
  lib/
    infra-stack.ts
```

## Notes

- 認証なしの匿名ユーザー設計です
- `anonId + createdAt` をキーにしてログを管理しています
- 一定期間後に古いログが自動削除されるよう、TTL を設定しています
