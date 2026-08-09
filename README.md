# Ryu Imamura — Digital Business Card

今村 立（Ryu IMAMURA）のモバイルファーストなデジタル名刺です。GitHub Pagesで動作する静的サイトで、バックエンドや外部CDN、アクセス解析を使用しません。

## ローカルで確認する

このフォルダで次を実行し、ブラウザで `http://localhost:8000` を開きます。

```powershell
python -m http.server 8000
```

## 掲載情報を変更する

氏名、肩書き、会社情報、連絡先、LinkedIn、キャッチコピー、公開URLはすべて `site-config.js` で管理します。

変更後、Node.jsが利用できる環境で次を実行すると、`contact.vcf` とOpen Graph用の公開URLが同期されます。

```powershell
npm run prepare-release
npm run check
```

## 公開URLとQRコード

`site-config.js` の `publicUrl` が共有・コピー・QRコードの参照先です。QRコードはブラウザ内で生成するため、外部のQRサービスへURLを送信しません。

公開先を変える場合は `publicUrl` を更新し、`npm run prepare-release` を実行してください。印刷物などで長期利用するQRには、ホスティング先のURLではなく、管理可能な短縮入口 `https://www.winbest.jp/card` を使うのが理想です。

## GitHub Pagesへ公開する

1. GitHubにリポジトリを作成して、このフォルダをpushします。
2. リポジトリの **Settings → Pages** を開きます。
3. **Deploy from a branch**、ブランチ `main`、フォルダ `/ (root)` を選択します。
4. 表示された公開URLを `site-config.js` の `publicUrl` に設定します。
5. `npm run prepare-release`、`npm run check` を実行して再度pushします。

## `www.winbest.jp/card` を入口にする

`/card` はDNSでは設定できません。`www.winbest.jp` を提供しているWebサーバーまたはCMS側で、GitHub PagesのURLへHTTP 301または302リダイレクトを設定します。転送準備が完了したら、`site-config.js` の `publicUrl` を `https://www.winbest.jp/card` に変更します。

## 公開情報とプライバシー

現在は、ユーザーの承認に基づき、紙の名刺と同じ以下の情報を公開します。

- 会社住所
- 会社電話
- FAX
- 携帯電話
- 会社メール
- 会社Webサイト
- LinkedIn

これらはHTML上で非表示にしても公開ファイルから取得できます。非公開に戻す場合は、画面だけでなく `site-config.js` と `contact.vcf` の両方から削除してください。

元の名刺画像、元写真、非公開の引き継ぎ資料は、この公開リポジトリに含めません。

## 画像

プロフィールは、提供された本人写真を参照して本人性を保ったエディトリアルイラストに変換しています。ロゴは提供素材の縦横比を維持した派生画像です。元素材は上書きしていません。

## 対応機能

- Web Share APIによるOS共有シート
- 未対応環境でのリンクコピー
- vCardによる連絡先保存
- オフライン同梱ライブラリによるQR表示
- iPhone、Android、狭いスマートフォン、Fold相当幅へのレスポンシブ対応
- キーボード操作、フォーカス表示、モーション低減設定
- Open Graphとアプリアイコン

QR生成にはMIT Licenseの [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) を同梱しています。ライセンスは `assets/vendor/qrcode-generator-LICENSE.txt` にあります。
