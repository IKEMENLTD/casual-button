/**
 * Casual Button - Netlify Function
 * /c/{base64url} へのアクセスを処理し、サンクスページを返す
 */

export default async (req, context) => {
  try {
    // URLパスからBase64URL文字列を取得
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/c/');
    const token = pathParts[1] || '';

    if (!token) {
      return new Response(errorPage('リンクが無効です', '正しいリンクからアクセスしてください。'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Base64URLデコード
    let payload;
    try {
      const padded = token + '='.repeat((4 - token.length % 4) % 4);
      const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      payload = JSON.parse(decoded);
    } catch (e) {
      return new Response(errorPage('リンクが無効です', 'リンクの形式が正しくありません。'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const { i: candidateId, o: optionId, n: candidateName } = payload;

    if (!candidateId || !optionId || !candidateName) {
      return new Response(errorPage('リンクが無効です', '必要な情報が不足しています。'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 環境変数
    const gasApiUrl = process.env.GAS_API_URL || '';
    const companyName = process.env.COMPANY_NAME || '';
    const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
    const optionsJson = process.env.OPTIONS_JSON || '[]';

    // 選択肢を取得
    let options;
    try {
      options = JSON.parse(optionsJson);
    } catch (e) {
      options = [];
    }

    // 現在の選択肢を検索
    const currentOption = options.find(opt => String(opt.id) === String(optionId));
    const selectedLabel = currentOption ? currentOption.label : '（不明な選択肢）';
    const thankYouMessage = currentOption ? currentOption.msg : 'ご回答を受け付けました。';

    // 回答変更用リンクを生成（現在の選択肢以外）
    const otherOptions = options.filter(opt => String(opt.id) !== String(optionId));
    const changeLinks = otherOptions.map(opt => {
      const newPayload = JSON.stringify({ i: candidateId, o: opt.id, n: candidateName });
      const encoded = Buffer.from(newPayload, 'utf-8').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return { label: opt.label, url: siteUrl + '/c/' + encoded };
    });

    // GAS APIにサーバー側から回答を記録（クライアント側では不安定なため）
    if (gasApiUrl) {
      try {
        await fetch(`${gasApiUrl}?action=respond&id=${encodeURIComponent(candidateId)}&option=${encodeURIComponent(String(optionId))}`, { redirect: 'follow' });
      } catch (e) {
        // 記録失敗しても候補者の画面には影響なし
      }
    }

    // サンクスページHTMLを生成
    const html = thankYouPage(candidateName, selectedLabel, thankYouMessage, changeLinks, companyName);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (e) {
    return new Response(errorPage('エラーが発生しました', '時間をおいて再度お試しください。'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

/**
 * サンクスページHTML
 */
function thankYouPage(name, label, message, changeLinks, company) {
  const changeLinkHtml = changeLinks.map(link =>
    `<a href="${escapeHtml(link.url)}" class="change-link">${escapeHtml(link.label)}</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>ご回答ありがとうございます</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

    :root {
      --bg: #f0f4f8;
      --ink: #2a4365;
      --line: rgba(42, 67, 101, 0.1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg);
      background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size: 20px 20px;
      color: var(--ink);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .card {
      background: #fff;
      max-width: 500px;
      width: 100%;
      padding: 50px 40px;
      border: 1px solid var(--ink);
      box-shadow: 0 10px 0 var(--ink);
      text-align: center;
    }

    .check-icon {
      display: inline-block;
      border: 1px solid var(--ink);
      padding: 2px 10px;
      font-size: 10px;
      margin-bottom: 30px;
      font-weight: 400;
    }

    h1 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 30px;
    }

    .response-label {
      font-size: 11px;
      opacity: 0.6;
      margin-bottom: 6px;
    }

    .response-value {
      display: inline-block;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 24px;
    }

    .thank-message {
      font-size: 12px;
      line-height: 1.8;
      margin-bottom: 30px;
      opacity: 0.8;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--line);
      margin: 0 0 30px;
    }

    .change-section-title {
      font-size: 10px;
      opacity: 0.6;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .change-links {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 30px;
    }

    .change-link {
      display: block;
      padding: 10px;
      border: 1px dashed var(--ink);
      color: var(--ink);
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      text-align: center;
      transition: background 0.15s;
    }

    .change-link:hover {
      background: var(--bg);
    }

    .company-name {
      font-size: 10px;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="check-icon">STATUS: RECORDED</div>
    <h1>ご回答ありがとうございます</h1>
    <p class="response-label">${escapeHtml(name)}さんの回答:</p>
    <p class="response-value">「${escapeHtml(label)}」</p>
    <p class="thank-message">${escapeHtml(message)}</p>
    <hr class="divider">
    <p class="change-section-title">回答を変更する場合</p>
    <div class="change-links">
      ${changeLinkHtml}
    </div>
    <p class="company-name">${escapeHtml(company)}</p>
  </div>
</body>
</html>`;
}

/**
 * エラーページHTML
 */
function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'JetBrains Mono', monospace;
      background: #f0f4f8;
      background-image: linear-gradient(rgba(42,67,101,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(42,67,101,0.1) 1px, transparent 1px);
      background-size: 20px 20px;
      color: #2a4365;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      max-width: 500px;
      width: 100%;
      padding: 50px 40px;
      border: 1px solid #2a4365;
      box-shadow: 0 10px 0 #2a4365;
      text-align: center;
    }
    .error-icon {
      display: inline-block;
      border: 1px solid #c53030;
      padding: 2px 10px;
      font-size: 10px;
      color: #c53030;
      margin-bottom: 30px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
    p { font-size: 12px; opacity: 0.7; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">ERROR</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
