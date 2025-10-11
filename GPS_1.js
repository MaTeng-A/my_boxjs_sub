// 名称: 天气GPS拦截
// 描述: 拦截GPS坐标同时确保天气数据正常显示

if (typeof $request !== "undefined") {
    // 拦截模式
    console.log("📍 拦截到WeatherKit请求");
    
    try {
        const url = $request.url;
        const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
        const res = url.match(pattern);
        
        if (res && res[1] && res[2]) {
            const lat = res[1];
            const lng = res[2];
            
            console.log(`🎯 提取坐标: ${lat}, ${lng}`);
            
            // 保存GPS数据
            const locationData = {
                latitude: lat,
                longitude: lng,
                timestamp: Date.now()
            };
            
            $persistentStore.write(JSON.stringify(locationData), "gps_location");
            
            // 发送通知
            $notification.post("📍 GPS拦截成功", `坐标: ${lat}, ${lng}`, "天气数据正常显示中");
        }
    } catch (error) {
        console.log("❌ 坐标提取失败:", error);
    }
    
    // 转发请求
    $httpClient.get($request, (error, response, data) => {
        if (error) {
            console.log("❌ 转发失败:", error);
            $done();
        } else {
            console.log("✅ 转发成功");
            $done({response: response});
        }
    });
    
} else {
    // 检查模式
    const gpsData = $persistentStore.read("gps_location");
    
    if (gpsData) {
        try {
            const location = JSON.parse(gpsData);
            const timeDiff = Math.round((Date.now() - location.timestamp) / 60000);
            
            $notification.post(
                "📍 GPS状态", 
                `坐标: ${location.latitude}, ${location.longitude}`,
                `更新时间: ${timeDiff}分钟前`
            );
        } catch (e) {
            $notification.post("❌ GPS数据错误", "解析失败", e.message);
        }
    } else {
        $notification.post("📍 无GPS数据", "请打开天气App", "等待定位数据...");
    }
    $done();
}