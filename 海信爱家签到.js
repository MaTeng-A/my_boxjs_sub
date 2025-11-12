/**
 * 海信爱家自动签到脚本
 * 功能：自动签到获取积分
 * 使用方法：配置重写规则后，进入海信爱家公众号会员中心获取Cookie
 */

const $ = new Env('海信爱家签到');

// 主函数
async function main() {
  let hisenseCk = $.getdata('hisense_ck');
  
  if (!hisenseCk) {
    $.msg($.name, '❌ 请先获取Cookie', '进入海信爱家公众号→个人中心→会员中心');
    return;
  }

  $.log('🚀 开始执行海信爱家签到');
  
  // 执行签到
  await checkin(hisenseCk);
  
  // 获取用户信息
  await getUserInfo(hisenseCk);
}

// 签到功能
async function checkin(cookie) {
  const options = {
    url: 'https://cps.hisense.com/customerAth/activity-manage/activityUser/participate',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      "code": "74f51fd29cea445e9b95eb0dd14fba40"
    })
  };

  try {
    const response = await $.http.post(options).json();
    
    if (response.isSuccess && response.resultCode === "00000") {
      const score = response.data?.obtainScore || 0;
      $.log(`✅ 签到成功！获得 ${score} 积分`);
      $.msg($.name, '签到成功', `获得 ${score} 积分 🎉`);
    } else if (response.resultCode === "A0202") {
      $.log(`ℹ️ 今日已签到`);
      $.msg($.name, '签到提醒', '今日已签到，请明天再来~');
    } else {
      $.log(`❌ 签到失败: ${response.resultMsg}`);
      $.msg($.name, '签到失败', response.resultMsg);
    }
  } catch (e) {
    $.log(`❌ 请求失败: ${e}`);
    $.msg($.name, '签到失败', '请检查网络或Cookie是否有效');
  }
}

// 获取用户信息
async function getUserInfo(cookie) {
  const options = {
    url: 'https://sweixin.hisense.com/ecrp/member/initMember',
    headers: {
      'Cookie': cookie
    }
  };

  try {
    const response = await $.http.get(options).json();
    
    if (response.data?.memberDetail) {
      const { score, customerName, gradeName } = response.data.memberDetail;
      $.log(`📊 用户: ${customerName || '未知'}`);
      $.log(`🏆 等级: ${gradeName || '未知'}`);
      $.log(`⭐ 积分: ${score || 0}`);
    }
  } catch (e) {
    $.log(`❌ 获取用户信息失败: ${e}`);
  }
}

// 获取Cookie（重写响应时触发）
if (typeof $response !== 'undefined') {
  const cookie = $request.headers?.Cookie || $request.headers?.cookie;
  
  if (cookie && /sweixin\.hisense\.com/.test($request.url)) {
    // 提取TOKEN_ACTIVITY
    const tokenMatch = $response.body?.match(/TOKEN_ACTIVITY=([^;]+)/);
    let finalCookie = cookie;
    
    if (tokenMatch) {
      finalCookie += `; ${tokenMatch[0]}`;
    }
    
    $.setdata(finalCookie, 'hisense_ck');
    $.msg($.name, '✅ Cookie获取成功', '已保存签到数据');
  }
  $done();
} else {
  // 定时任务执行
  (async () => {
    await main();
  })().catch(e => {
    $.log(`❌ 脚本执行错误: ${e}`);
    $.msg($.name, '执行失败', e.message);
  }).finally(() => {
    $.done();
  });
}

// 简化的Env类
function Env(name, opts) {
  class Http {
    constructor(env) { this.env = env }
    
    request(opts) {
      return new Promise((resolve, reject) => {
        if (typeof $httpClient !== 'undefined') {
          $httpClient[opts.method?.toLowerCase() || 'get'](opts, (err, resp, body) => {
            if (err) reject(err);
            else {
              resp.body = body;
              resolve(resp);
            }
          });
        } else {
          reject(new Error('不支持的运行环境'));
        }
      });
    }
    
    get(opts) {
      opts = typeof opts === 'string' ? { url: opts } : opts;
      opts.method = 'GET';
      return this.request(opts);
    }
    
    post(opts) {
      opts = typeof opts === 'string' ? { url: opts } : opts;
      opts.method = 'POST';
      return this.request(opts);
    }
  }
  
  return new class {
    constructor(name, opts) {
      this.name = name;
      this.http = new Http(this);
      this.logs = [];
      this.logSeparator = '\n';
      Object.assign(this, opts);
      this.log('', `🔔 ${this.name} 开始执行`);
    }

    // 获取环境类型
    getEnv() {
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $httpClient !== 'undefined' && typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      return 'Unknown';
    }

    // 数据存储
    getdata(key) {
      if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
      if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
      return null;
    }

    setdata(val, key) {
      if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
      if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
      return false;
    }

    // 日志记录
    log(...msg) {
      this.logs.push(...msg);
      console.log(msg.join(this.logSeparator));
    }

    // 消息通知
    msg(title, subtitle, body) {
      if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, body);
      }
      this.log(title, subtitle, body);
    }

    // 完成执行
    done(val = {}) {
      const costTime = (new Date().getTime() - this.startTime) / 1000;
      this.log('', `🔔 ${this.name} 执行结束 🕛 ${costTime}秒`);
      if (typeof $done !== 'undefined') $done(val);
    }
  }(name, opts);
}