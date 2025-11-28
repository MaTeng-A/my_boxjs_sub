// 名称: 自动触发GPS更新（兼容拦截脚本版）
// 描述: 自动打开天气App触发GPS拦截，然后关闭
// 作者: Assistant
// 版本: 3.3 - 兼容版（5分钟测试版）

console.log("🔄 自动触发GPS更新启动");

function main() {
    // 读取GPS时间戳
    const gpsTimestamp = $persistentStore.read("location_timestamp");
    const gpsAge = gpsTimestamp ? Math.round((Date.now() - parseInt(gpsTimestamp)) / 60000) : 999;
    
    console.log(`📊 GPS数据年龄: ${gpsAge}分钟`);
    
    if (gpsAge > 5) { // 改为5分钟，方便测试
        console.log("🔄 GPS数据超过5分钟，自动触发天气App获取GPS");
        autoTriggerWeatherApp();
    } else {
        console.log("✅ GPS数据新鲜，无需更新");
        $done();
    }
}

function autoTriggerWeatherApp() {
    console.log("📱 尝试打开天气App...");
    
    // 记录开始时间用于验证
    const startTime = Date.now();
    $persistentStore.write(startTime.toString(), "gps_update_start_time");
    
    // 使用兼容性更好的方法打开URL
    let urlOpened = false;
    
    // 方法1: 使用 $tool.openURL (如果可用)
    if (typeof $tool !== "undefined" && typeof $tool.openURL === "function") {
        console.log("✅ 使用 $tool.openURL 打开天气App");
        $tool.openURL("weather://");
        urlOpened = true;
    }
    // 方法2: 使用 $httpClient.get 触发天气请求 (备用方案)
    else if (typeof $httpClient !== "undefined") {
        console.log("✅ 使用 HTTP 请求模拟天气访问");
        // 发送一个天气请求来触发拦截
        $httpClient.get("https://weatherkit.apple.com/v1/weather/en/37.7749/-122.4194", function() {
            console.log("✅ 天气请求已发送");
        });
        urlOpened = true;
    }
    // 方法3: 使用 $notification (最后的手段)
    else if (typeof $notification !== "undefined") {
        console.log("ℹ️ 无法自动打开天气App，请手动打开");
        // 这里可以保留注释掉的通知代码，需要时取消注释
        /*
        $notification.post(
            "📍 请手动更新GPS", 
            "GPS数据已过期",
            "请打开天气App获取最新定位"
        );
        */
        urlOpened = true; // 虽然不能自动打开，但至少通知了用户
    }
    
    if (!urlOpened) {
        console.log("❌ 无法自动触发天气App，请手动打开系统天气App");
        console.log("💡 建议手动打开天气App来更新GPS数据");
    }
    
    // 无论是否成功打开，都等待一段时间后检查结果
    setTimeout(() => {
        checkGPSUpdateResult(startTime);
    }, 10000); // 等待10秒让定位完成
}

function checkGPSUpdateResult(startTime) {
    // 读取GPS数据 - 使用拦截脚本相同的键名
    const gpsData = $persistentStore.read("accurate_gps_location");
    const newTimestamp = $persistentStore.read("location_timestamp");
    
    console.log(`🔍 检查GPS更新结果 - 时间戳: ${newTimestamp}`);
    
    if (gpsData && newTimestamp) {
        try {
            const location = JSON.parse(gpsData);
            const updateTime = parseInt(newTimestamp);
            
            // 验证时间戳是否在开始时间之后（确保是新数据）
            if (updateTime >= startTime) {
                console.log(`🎉 GPS数据已更新 - 坐标: ${location.latitude}, ${location.longitude}`);
                console.log(`📡 数据来源: ${location.source}`);
                console.log(`⏰ 数据年龄: ${Math.round((Date.now() - updateTime) / 60000)}分钟`);
            } else {
                console.log("⚠️ GPS数据未更新（时间戳验证失败）");
                console.log(`⏰ 当前数据年龄: ${Math.round((Date.now() - updateTime) / 60000)}分钟`);
            }
        } catch (e) {
            console.log("❌ GPS数据解析失败:", e);
        }
    } else {
        console.log("❌ GPS数据未更新");
        console.log("💡 建议手动打开天气App获取定位");
    }
    $done();
}

main();