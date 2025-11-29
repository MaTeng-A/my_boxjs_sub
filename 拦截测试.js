// 名称: GPS拦截脚本
// 描述: 拦截天气请求获取GPS坐标
// 作者: Assistant
// 版本: 1.0

console.log("🎯 GPS拦截脚本启动");

if (typeof $request !== "undefined") {
    console.log("✅ 拦截到天气请求:", $request.url);
    
    const url = $request.url;
    let lat, lng;
    
    // 提取坐标
    const patterns = [
        /weatherkit\.apple\.com\/api\/v1\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
        /weather-data\.apple\.com\/v1\/weather\/([0-9.-]+)\/([0-9.-]+)/,
        /[?&]lat=([0-9.-]+)[&]?.*[?&]lng=([0-9.-]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            console.log(`🎯 提取到坐标: ${lat}, ${lng}`);
            break;
        }
    }
    
    if (lat && lng) {
        // 保存GPS数据
        const locationData = {
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high"
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存");
    }
    
    $done({});
} else {
    console.log("📊 GPS拦截脚本就绪");
    $done();
}