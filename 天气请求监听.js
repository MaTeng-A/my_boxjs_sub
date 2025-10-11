// 名称: 苹果天气请求监听器
// 描述: 监听所有苹果天气相关请求，分析实际API端点
// 作者: Assistant

console.log("🎯 开始监听苹果天气请求");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到请求");
    console.log("📡 完整URL:", $request.url);
    console.log("🔧 请求方法:", $request.method);
    console.log("📋 请求头:", JSON.stringify($request.headers, null, 2));
    
    // 保存详细的请求信息
    const requestInfo = {
        url: $request.url,
        method: $request.method,
        headers: $request.headers,
        timestamp: new Date().getTime(),
        domain: $request.url.split('/')[2]
    };
    
    // 读取历史记录
    let history = $persistentStore.read("apple_weather_requests");
    if (!history) {
        history = [];
    } else {
        history = JSON.parse(history);
    }
    
    // 添加新记录
    history.push(requestInfo);
    
    // 只保留最近20条记录
    if (history.length > 20) {
        history = history.slice(history.length - 20);
    }
    
    // 保存记录
    $persistentStore.write(JSON.stringify(history), "apple_weather_requests");
    
    // 发送通知
    $notification.post(
        "🎯 拦截到苹果请求",
        `域名: ${requestInfo.domain}`,
        `时间: ${new Date().toLocaleTimeString()}\n点击查看详情`
    );
    
} else {
    // 显示历史记录
    const history = $persistentStore.read("apple_weather_requests");
    
    if (history) {
        try {
            const requests = JSON.parse(history);
            console.log(`📊 历史记录: ${requests.length} 条请求`);
            
            let body = `共拦截到 ${requests.length} 条请求:\n\n`;
            
            requests.forEach((req, index) => {
                body += `🔗 ${req.domain}\n`;
                body += `⏰ ${new Date(req.timestamp).toLocaleTimeString()}\n`;
                body += `📝 ${req.method} ${req.url.split('?')[0]}\n`;
                body += "─".repeat(30) + "\n";
            });
            
            $notification.post(
                "📊 请求历史分析",
                `发现 ${requests.length} 条苹果请求`,
                body
            );
            
        } catch (e) {
            console.log("❌ 历史记录解析失败:", e);
            $notification.post("❌ 数据分析失败", "历史记录格式错误", e.message);
        }
    } else {
        $notification.post(
            "📊 请求历史分析", 
            "暂无拦截记录",
            "请打开天气App并等待自动刷新"
        );
    }
}

$done();
