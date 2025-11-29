// 名称: 增强版GPS拦截
// 描述: 增强拦截能力，处理HTTP请求触发
// 作者: Assistant
// 版本: 4.0 - 增强拦截版

console.log("🎯 增强版GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到请求:", $request.url);
    
    const url = $request.url;
    let lat, lng;
    
    // 增强URL模式匹配
    const patterns = [
        /weatherkit\.apple\.com\/api\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weather-data\.apple\.com\/v1\/weather\/([0-9.-]+)\/([0-9.-]+)/,
        /weather-data\.apple\.com\/v2\/weather\/([0-9.-]+)\/([0-9.-]+)/,
        /weather-data\.apple\.com\/v3\/weather\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/,
        /[?&]latitude=([0-9.-]+)[&]?.*[?&]longitude=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            console.log(`🎯 从URL提取坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        console.log(`📍 成功提取坐标: ${lat}, ${lng}`);
        
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
        
    } else {
        console.log("❌ 未从URL中找到坐标信息");
    }
    
    $done({});
    
} else {
    // 手动检查模式
    console.log("📊 GPS状态检查");
    const locationData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (locationData && timestamp) {
        try {
            const location = JSON.parse(locationData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            
            console.log(`🌍 当前GPS数据: ${location.latitude}, ${location.longitude}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
            console.log(`📡 数据来源: ${location.source}`);
            
        } catch (e) {
            console.log("❌ 数据解析失败:", e);
        }
    } else {
        console.log("❌ 无GPS定位数据");
    }
    $done();
}