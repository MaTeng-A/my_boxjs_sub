// 名称: GPS拦截调试版
// 描述: 调试天气GPS坐标拦截问题
// 作者: Assistant
// 版本: 3.0 - 调试版

console.log("🎯 GPS拦截脚本启动 - 调试版本");

if (typeof $request !== "undefined" && $request) {
    console.log("✅ 成功进入请求拦截分支");
    console.log("🔍 请求URL:", $request.url);
    console.log("🔍 请求方法:", $request.method);
    
    const url = $request.url;
    
    // 使用新的坐标提取函数
    const coords = extractCoordinates(url);
    
    if (coords) {
        console.log(`📍 成功提取坐标: ${coords.lat}, ${coords.lng}`);
        
        // 保存数据
        const locationData = {
            latitude: coords.lat,
            longitude: coords.lng,
            timestamp: Date.now(),
            source: "weatherkit_apple",
            accuracy: "high",
            url: url
        };
        
        $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
        $persistentStore.write(Date.now().toString(), "location_timestamp");
        
        console.log("💾 GPS数据已保存到持久化存储");
        
    } else {
        console.log("❌ 无法从URL中提取坐标");
        console.log("🔍 请检查URL格式:", url);
    }
    
    // 完成请求
    $done({});
    
} else {
    console.log("⚠️ 脚本在手动模式下运行");
    
    // 检查存储的数据
    const storedData = $persistentStore.read("accurate_gps_location");
    const timestamp = $persistentStore.read("location_timestamp");
    
    if (storedData) {
        try {
            const location = JSON.parse(storedData);
            const timeDiff = Math.round((Date.now() - parseInt(timestamp)) / 60000);
            console.log(`📊 存储的GPS数据: ${location.latitude}, ${location.longitude}`);
            console.log(`⏰ 更新时间: ${timeDiff}分钟前`);
        } catch (e) {
            console.log("❌ 解析存储数据失败:", e);
        }
    } else {
        console.log("❌ 没有找到存储的GPS数据");
    }
    
    $done();
}

function extractCoordinates(url) {
    console.log("🔍 开始解析URL:", url);
    
    // 主要匹配模式：/v2/weather/zh-Hans-CN/33.474/116.193
    const pathPattern = /weatherkit\.apple\.com\/v\d+\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
    const pathMatch = url.match(pathPattern);
    
    if (pathMatch && pathMatch[1] && pathMatch[2]) {
        console.log(`🎯 路径匹配成功: ${pathMatch[1]}, ${pathMatch[2]}`);
        return { lat: pathMatch[1], lng: pathMatch[2] };
    }
    
    console.log("❌ 路径匹配失败，尝试其他方法...");
    
    // 备用方法：URL查询参数
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        
        const lat = params.get('lat') || params.get('latitude');
        const lng = params.get('lng') || params.get('longitude') || params.get('lon');
        
        if (lat && lng) {
            console.log(`🎯 查询参数匹配成功: ${lat}, ${lng}`);
            return { lat, lng };
        }
    } catch (e) {
        console.log("❌ URL对象解析失败:", e);
    }
    
    console.log("❌ 所有坐标提取方法都失败了");
    return null;
}