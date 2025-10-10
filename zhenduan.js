// 名称: WeatherKit详细诊断
// 描述: 详细分析WeatherKit请求，找出问题所在
// 作者: Assistant

console.log("🔍 WeatherKit详细诊断开始");

if (typeof $request !== "undefined") {
    console.log("✅ 检测到$request对象");
    console.log("📡 完整URL:", $request.url);
    console.log("🔧 请求方法:", $request.method);
    
    // 保存原始请求信息
    const requestInfo = {
        url: $request.url,
        method: $request.method,
        timestamp: new Date().getTime(),
        hasCoords: false
    };
    
    // 检查URL是否包含坐标
    if ($request.url.includes("weatherkit.apple.com")) {
        console.log("🎯 这是WeatherKit请求");
        
        // 多种匹配模式尝试
        const patterns = [
            /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/,
            /weatherkit\.apple\.com\/.*\/([0-9.-]+)\/([0-9.-]+)/,
            /lat=([0-9.-]+)/,
            /latitude=([0-9.-]+)/,
            /lng=([0-9.-]+)/, 
            /longitude=([0-9.-]+)/
        ];
        
        let lat, lng;
        
        for (const pattern of patterns) {
            const res = $request.url.match(pattern);
            if (res) {
                console.log(`✅ 匹配到模式: ${pattern}`);
                
                if (pattern.toString().includes("lat") || pattern.toString().includes("latitude")) {
                    lat = res[1];
                    // 继续找经度
                    const lngPattern = /[?&](?:lng|longitude)=([0-9.-]+)/;
                    const lngRes = $request.url.match(lngPattern);
                    if (lngRes) lng = lngRes[1];
                } else if (res.length >= 3) {
                    lat = res[1];
                    lng = res[2];
                }
                
                if (lat && lng) {
                    requestInfo.hasCoords = true;
                    requestInfo.latitude = lat;
                    requestInfo.longitude = lng;
                    break;
                }
            }
        }
        
        if (requestInfo.hasCoords) {
            console.log(`🎯 提取到坐标: ${lat}, ${lng}`);
            
            // 保存GPS数据
            const locationData = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                source: "weatherkit_diagnostic",
                timestamp: new Date().getTime(),
                url: $request.url
            };
            
            $persistentStore.write(JSON.stringify(locationData), "diagnostic_gps_location");
            
            $notification.post(
                "🔍 诊断-有坐标", 
                `纬度: ${lat}, 经度: ${lng}`,
                `URL: ${$request.url.split('?')[0]}`
            );
            
        } else {
            console.log("❌ 未找到坐标信息");
            console.log("📋 URL分析:", $request.url);
            
            $notification.post(
                "🔍 诊断-无坐标", 
                "WeatherKit请求但无坐标",
                `URL: ${$request.url.substring(0, 100)}...`
            );
        }
        
        // 保存请求信息供分析
        $persistentStore.write(JSON.stringify(requestInfo), "last_weatherkit_request");
        
    } else {
        console.log("❌ 不是WeatherKit请求");
    }
    
} else {
    console.log("❌ 未检测到$request对象 - 定时任务模式");
    
    // 显示诊断结果
    const lastRequest = $persistentStore.read("last_weatherkit_request");
    const gpsData = $persistentStore.read("diagnostic_gps_location");
    
    let body = "诊断结果:\n\n";
    
    if (lastRequest) {
        const request = JSON.parse(lastRequest);
        body += `最后请求: ${new Date(request.timestamp).toLocaleTimeString()}\n`;
        body += `有坐标: ${request.hasCoords ? '是' : '否'}\n`;
        if (request.hasCoords) {
            body += `坐标: ${request.latitude}, ${request.longitude}\n`;
        }
        body += `URL: ${request.url.split('?')[0]}\n`;
    } else {
        body += "无WeatherKit请求记录\n";
    }
    
    body += "\n";
    
    if (gpsData) {
        const location = JSON.parse(gpsData);
        const timeDiff = Math.round((Date.now() - location.timestamp) / 1000 / 60);
        body += `GPS数据: ${location.latitude}, ${location.longitude}\n`;
        body += `更新时间: ${timeDiff}分钟前\n`;
    } else {
        body += "无GPS数据\n";
    }
    
    $notification.post("🔍 WeatherKit诊断", "详细分析报告", body);
}

$done();
