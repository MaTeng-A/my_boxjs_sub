// 名称: 最终版GPS拦截
// 描述: 拦截GPS并确保天气正常显示

console.log("🎯 GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    // 提取坐标 - 多种匹配模式
    const url = $request.url;
    let lat, lng;
    
    // 模式1: weatherkit.apple.com/v1/weather/[语言]/[lat]/[lng]
    let match1 = url.match(/weatherkit\.apple\.com\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/);
    // 模式2: weatherkit.apple.com/v2/weather/[语言]/[lat]/[lng]  
    let match2 = url.match(/weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/);
    // 模式3: 其他可能的格式
    let match3 = url.match(/[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/);
    
    if (match1) {
        lat = match1[1];
        lng = match1[2];
    } else if (match2) {
        lat = match2[1];
        lng = match2[2];
    } else if (match3) {
        lat = match3[1];
        lng = match3[2];
    }
    
    if (lat && lng) {
        console.log(`🎯 提取到坐标: ${lat}, ${lng}`);
        
        // 保存数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "gps_location");
        
        // 发送通知
        $notification.post(
            "📍 GPS拦截成功", 
            `坐标: ${lat}, ${lng}`,
            "天气数据正常显示中"
        );
    } else {
        console.log("❌ 未找到坐标信息");
    }
    
    // 关键：直接完成请求
    $done({});
    
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
            $notification.post("❌ 数据错误", "解析失败", e.message);
        }
    } else {
        $notification.post(
            "📍 无GPS数据", 
            "请打开天气App",
            "确保MitM配置正确"
        );
    }
    $done();
}