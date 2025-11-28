// 名称: 自动触发GPS更新（兼容拦截脚本版）
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 版本: 3.4 - 兼容增强版

console.log("🔄 自动触发GPS更新启动");

function main() {
    // 读取GPS时间戳
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) { // 5分钟测试阈值
        console.log("🔄 GPS数据超过5分钟，自动触发天气App获取GPS");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 尝试多种方法触发天气App...");
    
    // 记录开始时间用于验证
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    let methodUsed = false;
    
    // 方法1: 尝试使用 $tool.openURL (如果可用)
    if (typeof $tool !== "undefined" && typeof $tool.openURL === "function") {
        console.log("✅ 使用方法1: $tool.openURL");
        $tool.openURL("weather://");
        methodUsed = true;
    }
    // 方法2: 尝试使用环境特定的打开URL方法
    else if (typeof $environment !== "undefined" && $environment['surge-version']) {
        console.log("✅ 使用方法2: Surge环境 - $notification点击动作");
        // 在Surge中可以通过通知点击打开URL
        $notification.post("GPS更新", "点击打开天气App", "", { url: "weather://" });
        methodUsed = true;
    }
    // 方法3: 尝试使用 $httpClient.post 发送特殊请求
    else if (typeof $httpClient !== "undefined") {
        console.log("✅ 使用方法3: 模拟真实天气请求");
        // 发送更真实的天气请求，模拟实际App行为
        const realisticURLs = [
            "https://weatherkit.apple.com/api/v1/weather/en/37.3318/-122.0312", // 苹果总部坐标
            "https://gspe35-ssl.ls.apple.com/weatherkit/api/v1/weather/en/37.3318/-122.0312",
            "https://weather-data.apple.com/v1/weather/en/37.3318/-122.0312"
        ];
        
        realisticURLs.forEach(url => {
            $httpClient.get({
                url: url,
                headers: {
                    'User-Agent': 'Weather/1.0 CFNetwork/1404.0.5 Darwin/22.3.0',
                    'Accept': 'application/json',
                    'Accept-Language': 'zh-CN,zh;q=0.9'
                }
            }, function(error, response, data) {
                if (!error) {
                    console.log(`✅ 请求发送成功: ${response.status}`);
                }
            });
        });
        methodUsed = true;
    }
    
    if (!methodUsed) {
        console.log("❌ 无法自动触发天气App");
        console.log("💡 请手动打开系统天气App来更新GPS数据");
        $done();
        return;
    }
    
    console.log("⏳ 等待10秒让定位完成...");
    
    // 等待10秒后检查结果
    setTimeout(() => {
        checkGPSUpdateResult(startTime);
    }, 10000);
}

function checkGPSUpdateResult(startTime) {
    // 读取GPS数据
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log(`🔍 检查GPS更新结果`);
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            const newAge = Math.round((Date.now() - updateTime) / 60000);
            
            // 验证时间戳是否在开始时间之后（确保是新数据）
            if (updateTime >= startTime) {
                console.log(`🎉 GPS数据已更新!`);
                console.log(`📍 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 来源: ${location.source}`);
                console.log(`⏰ 数据年龄: ${newAge}分钟`);
            } else {
                console.log("⚠️ GPS数据未更新");
                console.log(`⏰ 当前数据年龄: ${newAge}分钟`);
                console.log("💡 自动触发可能失败，请手动打开天气App");
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ 没有找到GPS数据");
        console.log("💡 自动触发失败，请手动打开天气App获取定位");
    }
    $done();
}

main();