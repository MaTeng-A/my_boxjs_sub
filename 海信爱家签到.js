// 海信域名探测脚本（优化版）
const $ = new Env('海信域名探测');

if (typeof $request !== 'undefined') {
  const host = $request.url.split('/')[2];
  
  // 定义海信相关关键词
  const hisenseKeywords = ['hisense', 'haixin', '海信', 'haier'];
  
  let isHisense = false;
  for (const keyword of hisenseKeywords) {
    if (host.toLowerCase().includes(keyword)) {
      isHisense = true;
      break;
    }
  }
  
  if (isHisense) {
    $.log(`发现疑似海信域名: ${host}`);
    
    // 保存发现的域名
    const savedDomains = $persistentStore.read('hisense_domains') || '';
    if (!savedDomains.includes(host)) {
      const newDomains = savedDomains ? `${savedDomains},${host}` : host;
      $persistentStore.write(newDomains, 'hisense_domains');
      $.msg('海信域名探测', '发现新域名', host);
    }
  }
  
  $done();
} else {
  // 普通执行模式 - 显示已发现的所有域名
  const savedDomains = $persistentStore.read('hisense_domains');
  if (savedDomains) {
    const domains = savedDomains.split(',');
    $.log(`已发现 ${domains.length} 个疑似海信域名:`);
    domains.forEach(domain => $.log(` - ${domain}`));
    $.msg('海信域名探测', `发现 ${domains.length} 个域名`, '请查看日志详情');
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