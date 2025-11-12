// 海信全面接口记录脚本
const $ = new Env('海信全面记录');

if (typeof $response !== 'undefined') {
  const url = $request.url;
  const method = $request.method;
  const path = url.split('/').pop();
  const domain = url.split('/')[2];
  
  // 记录所有请求到日志
  console.log(`🌐 ${method} ${path} (${domain})`);
  
  // 如果是POST请求，记录请求体
  if (method === 'POST' && $request.body) {
    console.log(`📦 请求体: ${$request.body.substring(0, 500)}`);
  }
  
  // 记录响应体（如果是JSON且包含重要信息）
  if ($response.body && typeof $response.body === 'string') {
    try {
      const jsonBody = JSON.parse($response.body);
      if (jsonBody.code === 0 || jsonBody.success || jsonBody.data) {
        console.log(`✅ 响应成功: ${JSON.stringify(jsonBody).substring(0, 300)}`);
      }
    } catch (e) {
      // 不是JSON格式，忽略
    }
  }
  
  // 保存Cookie和认证信息
  const headers = $request.headers;
  if (headers['Cookie'] || headers['cookie']) {
    const cookie = headers['Cookie'] || headers['cookie'];
    $persistentStore.write(cookie, 'hisense_cookie');
  }
  
  if (headers['Authorization']) {
    $persistentStore.write(headers['Authorization'], 'hisense_auth');
  }
  
  // 保存用户ID（如果发现）
  if (url.includes('userId=')) {
    const userIdMatch = url.match(/userId=(\d+)/);
    if (userIdMatch) {
      $persistentStore.write(userIdMatch[1], 'hisense_user_id');
      console.log(`👤 用户ID: ${userIdMatch[1]}`);
    }
  }
}

$done();

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
    }
  }(name);
}