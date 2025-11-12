// 海信签到接口重点捕获
const $ = new Env('海信签到捕获');

if (typeof $response !== 'undefined') {
  const url = $request.url;
  const method = $request.method;
  const path = url.split('/').pop();
  
  // 重点关注的关键词
  const signKeywords = ['sign', 'check', 'attend', 'task', 'point', 'score', 'daily', 'complete', 'join', 'participate'];
  const isImportant = signKeywords.some(keyword => path.toLowerCase().includes(keyword));
  
  if (isImportant) {
    $.log(`🚨 重要接口捕获: ${path}`);
    $.log(`完整URL: ${url}`);
    $.log(`请求方法: ${method}`);
    
    // 保存重要接口详情
    const importantApis = $persistentStore.read('hisense_important_apis') || '[]';
    const apis = JSON.parse(importantApis);
    
    const apiDetail = {
      path: path,
      url: url,
      method: method,
      timestamp: new Date().toISOString()
    };
    
    if (!apis.some(api => api.path === path)) {
      apis.push(apiDetail);
      $persistentStore.write(JSON.stringify(apis), 'hisense_important_apis');
      $.msg('海信签到', '发现重要接口', path);
    }
    
    // 保存请求体和响应体
    if (method === 'POST' && $request.body) {
      $.log(`请求体: ${$request.body.substring(0, 300)}`);
      $persistentStore.write($request.body, `hisense_body_${path}`);
    }
    
    if ($response.body) {
      const bodyStr = typeof $response.body === 'string' ? $response.body : JSON.stringify($response.body);
      $.log(`响应体: ${bodyStr.substring(0, 300)}`);
      $persistentStore.write(bodyStr, `hisense_response_${path}`);
    }
  }
  
  // 继续保存所有接口
  const allApis = $persistentStore.read('hisense_all_apis') || '[]';
  const allApiList = JSON.parse(allApis);
  if (!allApiList.includes(path)) {
    allApiList.push(path);
    $persistentStore.write(JSON.stringify(allApiList), 'hisense_all_apis');
  }
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