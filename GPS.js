// 名称: 极简GPS拦截器
// 描述: 只提取坐标，立即完成请求
// 作者: Assistant

console.log("📍 极简GPS拦截器启动");

if (typeof $request !== "undefined") {
    const url = $request.url;
    
    if (url.includes("weatherkit.apple.com")) {
        const pattern = /weatherkit\.apple\.com\/v2\/weather\/[^\/]+\/([0-9.-]+)\/([0-9.-]+)/;
        const res = url.match(pattern);
        
        if (res && res[1] && res[2]) {
            const locationData = {
                latitude: parseFloat(res[1]),
                longitude: parseFloat(res[2]),
                source: "weatherkit_minimal",
                timestamp: Date.now()
            };
            
            $persistentStore.write(JSON.stringify(locationData), "accurate_gps_location");
            $persistentStore.write(Date.now().toString(), "location_timestamp");
            
            console.log(`✅ 坐标保存: ${res[1]}, ${res[2]}`);
        }
    }
    
    // 立即完成请求，不干扰天气App
    $done();
} else {
    $done();
}
