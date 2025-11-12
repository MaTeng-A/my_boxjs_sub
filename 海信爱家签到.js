// 海信接口捕获脚本
const $ = new Env('海信接口捕获');

if (typeof $response !== 'undefined') {
  const url = $request.url;
  const method = $request.method;
  
  $.log(`=== 捕获到海信请求 ===`);
  $.log(`URL: ${url}`);
  $.log(`方法: ${method}`);
  
  // 检查请求头
  const headers = $request.headers;
  if (headers['Cookie'] || headers['cookie']) {
    const cookie = headers['Cookie'] || headers['cookie'];
    $.log(`发现Cookie: ${cookie.substring(0, 50)}...`);
    
    // 保存Cookie
    $persistentStore.write(cookie, 'hisense_cookie');
    $.log('Cookie已保存');
  }
  
  if (headers['Authorization']) {
    $.log(`发现Authorization: ${headers['Authorization'].substring(0, 30)}...`);
    $persistentStore.write(headers['Authorization'], 'hisense_auth');
  }
  
  // 检查响应体
  if ($response.body) {
    const bodyStr = JSON.stringify($response.body).substring(0, 200);
    $.log(`响应体: ${bodyStr}...`);
    
    // 尝试从响应体提取token
    if (typeof $response.body === 'string') {
      const tokenMatch = $response.body.match(/"token":"([^"]+)"/);
      if (tokenMatch) {
        $.log(`发现token: ${tokenMatch[1]}`);
        $persistentStore.write(tokenMatch[1], 'hisense_token');
      }
    }
  }
  
  $.msg('海信接口', '捕获到请求', url.split('/').pop());
}

$done();

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
    }
    
    log(...msg) {
      console.log(msg.join(' '));
    }
    
    msg(title, subtitle, body) {
      console.log(title, subtitle, body);
      if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, body);
      }
    }
  }(name);
}