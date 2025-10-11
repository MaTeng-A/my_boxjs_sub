// 名称: 精准苹果天气GPS定位 (转发修复版)
// 描述: 提取GPS坐标的同时，转发请求以确保天气App正常工作
// 作者: Assistant
// 更新时间: 2025-10-10

console.log("🎯 精准苹果天气GPS定位 (转发版)启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    console.log("📡 完整URL:", $request.url);
    
    // 1. 首先尝试从URL中提取GPS坐标
    const url = $request.url;
    const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
    const res = url.match(pattern);
    
    if (res && res[1] && res[2]) {
        const lat = res[1];
        const lng = res[2];
        console.log(`🎯 成功提取坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据到持久化存储
        const locationData = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            source: "weatherkit_apple",
            timestamp: new Date().getTime()
        };
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        console.log("✅ GPS坐标已保存");
    }

    // 2. 关键步骤：创建转发请求，将原请求发送给苹果服务器
    // 注：具体实现方式取决于您使用的脚本工具（如Loon、Quantumult X等）
    // 这里以通用的 $httpClient 为例，实际请参考您工具的文档
    $httpClient.get($request.url, (error, response, data) => {
        if (error) {
            console.log(`❌ 转发请求失败: ${error}`);
            // 即使转发失败，也需要完成脚本，否则天气App会一直等待
            $done();
        } else {
            console.log("✅ 请求转发成功，将数据返回给天气App");
            // 将苹果服务器返回的数据原样传递回去
            $done({
                status: response.status,
                headers: response.headers,
                body: data
            });
        }
    });

} else {
    // 以下是定时任务模式（用于检查状态等），与拦截逻辑无关
    console.log("⏰ 定时任务模式");
    // ... [您原有的状态检查代码] ...
    $done();
}
