// 海信域名探测脚本
const $ = new Env('海信域名探测');

if (typeof $request !== 'undefined') {
  // 记录所有请求的域名
  const host = $request.url.split('/')[2];
  $.log(`捕获到请求: ${host}`);
  
  // 如果包含海信相关关键词，保存并通知
  if (host.includes('hisense') || host.includes('海信') || host.includes('haier')) {
    const saveResult = $persistentStore.write(host, 'hisense_domain');
    $.log(`发现疑似海信域名: ${host}, 保存结果: ${saveResult}`);
    $.msg('海信域名探测', '发现域名', host);
  }
  
  $done();
} else {
  // 普通执行模式
  const savedDomain = $persistentStore.read('hisense_domain');
  if (savedDomain) {
    $.log(`已保存的域名: ${savedDomain}`);
    $.msg('海信域名探测', '已保存域名', savedDomain);
  } else {
    $.log('尚未发现海信域名');
    $.msg('海信域名探测', '等待发现', '请在海信公众号内操作');
  }
  $done();
}

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
      console.log(`🔔 ${name} 开始`);
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