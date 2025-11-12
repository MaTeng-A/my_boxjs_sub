// 全面域名探测脚本
const $ = new Env('全面域名探测');

if (typeof $request !== 'undefined') {
  const url = $request.url;
  const host = url.split('/')[2];
  
  // 记录所有请求（限制频率，避免过多日志）
  const now = Date.now();
  const lastLog = $persistentStore.read('last_log_time') || 0;
  
  if (now - lastLog > 1000) { // 每秒最多记录一次
    console.log(`📡 请求: ${host}${url.includes('/ecrp/') ? ' ← 疑似海信接口' : ''}`);
    $persistentStore.write(now.toString(), 'last_log_time');
  }
  
  // 保存所有不同的域名
  const savedDomains = $persistentStore.read('all_domains') || '';
  if (!savedDomains.includes(host)) {
    const newDomains = savedDomains ? `${savedDomains},${host}` : host;
    $persistentStore.write(newDomains, 'all_domains');
  }
  
  $done();
} else {
  // 普通执行模式 - 显示所有发现的域名
  const allDomains = $persistentStore.read('all_domains');
  
  if (allDomains) {
    const domains = allDomains.split(',');
    $.log(`=== 发现 ${domains.length} 个域名 ===`);
    
    // 分类显示
    const likelyDomains = domains.filter(d => 
      d.includes('hisense') || d.includes('weixin') || d.includes('ecrp') || 
      d.includes('cps') || d.includes('wx') || d.includes('qq.com')
    );
    
    const otherDomains = domains.filter(d => 
      !d.includes('hisense') && !d.includes('weixin') && !d.includes('ecrp') && 
      !d.includes('cps') && !d.includes('wx') && !d.includes('qq.com')
    );
    
    if (likelyDomains.length > 0) {
      $.log('🚨 疑似相关域名:');
      likelyDomains.forEach(d => $.log(`   - ${d}`));
    }
    
    if (otherDomains.length > 0) {
      $.log('🔍 其他域名:');
      otherDomains.slice(0, 10).forEach(d => $.log(`   - ${d}`)); // 只显示前10个
      if (otherDomains.length > 10) {
        $.log(`   ... 还有 ${otherDomains.length - 10} 个其他域名`);
      }
    }
    
    $.msg('域名探测完成', `发现 ${domains.length} 个域名`, '请查看Loon日志');
  } else {
    $.log('尚未发现任何域名');
    $.msg('域名探测', '无域名发现', '请确认MITM配置');
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