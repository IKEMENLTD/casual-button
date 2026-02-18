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

    // サンクスページHTMLを生成
    const html = thankYouPage(candidateName, selectedLabel, thankYouMessage, changeLinks, companyName, gasApiUrl, candidateId, optionId);

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
function thankYouPage(name, label, message, changeLinks, company, gasApiUrl, candidateId, optionId) {
  const changeLinkHtml = changeLinks.map(link =>
    `<a href="${escapeHtml(link.url)}" class="change-link">${escapeHtml(link.label)}</a>`
  ).join('');

  const beaconUrl = gasApiUrl
    ? `${escapeHtml(gasApiUrl)}?action=respond&id=${escapeHtml(candidateId)}&option=${escapeHtml(String(optionId))}`
    : '';
  const beaconScript = beaconUrl
    ? `<iframe src="${beaconUrl}" style="display:none" width="0" height="0"></iframe>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>ご回答ありがとうございます</title>
  <style>
    :root {
      --primary: #0056b3;
      --primary-light: #e6f0fa;
      --surface: #ffffff;
      --background: #f4f6f9;
      --text-main: #212529;
      --text-muted: #6c757d;
      --border: #dee2e6;
      --success: #d1fae5;
      --success-text: #065f46;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: var(--background);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .card {
      background: var(--surface);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.06);
      border: 1px solid var(--border);
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }

    .check-icon {
      width: 64px;
      height: 64px;
      background-color: var(--success);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
      color: var(--success-text);
      font-weight: bold;
    }

    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 20px;
      line-height: 1.4;
    }

    .response-label {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .response-value {
      display: inline-block;
      background-color: var(--primary-light);
      color: var(--primary);
      font-weight: 600;
      font-size: 0.95rem;
      padding: 6px 16px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .thank-message {
      font-size: 0.95rem;
      color: var(--text-main);
      line-height: 1.7;
      margin-bottom: 28px;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 0 0 24px;
    }

    .change-section-title {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 12px;
    }

    .change-links {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 28px;
    }

    .change-link {
      display: block;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--primary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background-color 0.15s, border-color 0.15s;
    }

    .change-link:hover {
      background-color: var(--primary-light);
      border-color: var(--primary);
    }

    .company-name {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="check-icon">&#10003;</div>
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
  ${beaconScript}
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #f4f6f9;
      color: #212529;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.06);
      border: 1px solid #dee2e6;
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      background-color: #fee2e2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
      color: #991b1b;
    }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 0.95rem; color: #6c757d; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">!</div>
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
