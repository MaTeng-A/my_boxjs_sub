// 名称: Loon简化版GPS定位
// 描述: 仅提取GPS坐标，不干扰原始请求
// 作者: Assistant
// 工具: Loon
// 更新时间: 2025-10-10

console.log("🎯 Loon简化版GPS定位启动");

if (typeof $request !== "undefined") {
    console.log("📍 拦截到WeatherKit请求");
    
    try {
        const url = $request.url;
        
        if (url.includes("weatherkit.apple.com")) {
            // 提取GPS坐标
            const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
            const res = url.match(pattern);
            
            if (res && res[1] && res[2]) {
                const lat = res[1];
                const lng = res[2];
                
                console.log(`🎯 成功提取坐标: ${lat}, ${lng}`);
                
                // 保存GPS数据
                const locationData = {
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng),
                    source: "weatherkit_apple_simple",
                    timestamp: new Date().getTime(),
                    accuracy: "high"
                };
                
                $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
                $persistentStore.write(Date.now().toString(), "location_timestamp");
                
                console.log("✅ GPS数据已保存");
                
                // 可选：静默通知（不会干扰天气App）
                // $notification.post("📍 GPS更新", `坐标: ${lat}, ${lng}`, "静默模式");
            }
        }
        
    } catch (error) {
        console.log("❌ 拦截处理出错:", error);
    }
    
    // 关键：直接调用 $done()，让原始请求正常继续
    $done();
    
} else {
    // 定时任务模式 - 显示当前GPS状态
    console.log("⏰ GPS状态检查模式");
    
    const locationData = $persistentStore.read("accurate_gps_location");
    
    if (locationData) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - location.timestamp) / 1000 / 60);
            
            console.log(`📊 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            
            $notification.post(
                "📍 GPS定位状态", 
                `坐标: ${location.latitude}, ${location.longitude}`,
                `更新时间: ${timeDiff}分钟前\n来源: ${location.source}`
            );
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
        }
    } else {
        console.log("❌ 无GPS定位数据");
    }
    
    $done();
}
