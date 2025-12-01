// 名称: Loon天气GPS强制触发脚本
// 描述: 专门针对GPS拦截优化的触发脚本
// 版本: 3.0 - 强制触发版

console.log("🎯 GPS强制触发脚本启动");

class GPSForceTrigger {
    constructor() {
        this.config = {
            triggerDelay: 3000, // 3秒延迟确保App启动
            retryInterval: 2000,
            maxRetries: 3
        };
    }
    
    async forceTriggerGPS() {
        console.log("📍 开始强制触发GPS定位");
        
        // 步骤1: 关闭天气App（如果正在运行）
        await this.closeWeatherApp();
        
        // 步骤2: 等待一小段时间
        await this.delay(1000);
        
        // 步骤3: 重新打开天气App
        await this.openWeatherAppWithLocation();
        
        // 步骤4: 发送特定的位置请求
        await this.sendLocationSpecificRequests();
        
        console.log("✅ GPS强制触发完成");
    }
    
    async closeWeatherApp() {
        console.log("🔒 尝试关闭天气App");
        // 通过打开其他App来"挤掉"天气App
        const otherApps = [
            "maps://",
            "music://",
            "sms://"
        ];
        
        for (let app of otherApps) {
            $httpClient.get(app, () => {});
            await this.delay(500);
        }
    }
    
    async openWeatherAppWithLocation() {
        console.log("🌤️ 打开天气App并请求位置");
        
        // 使用更具体的天气URL Scheme
        const locationSpecificSchemes = [
            "weather://?location=current",
            "x-apple-weather://location/current",
            "weather://locations/current",
            "weather://"
        ];
        
        for (let scheme of locationSpecificSchemes) {
            console.log(`尝试打开: ${scheme}`);
            $httpClient.get(scheme, (error, response) => {
                if (!error) {
                    console.log(`✅ 成功: ${scheme}`);
                }
            });
            await this.delay(1500);
        }
    }
    
    async sendLocationSpecificRequests() {
        console.log("📡 发送位置特定请求");
        
        // 使用您之前成功拦截的精确URL格式
        const successfulPatterns = [
            // 这里填入您之前成功拦截的天气请求URL格式
            "https://weatherkit.apple.com/v1/weather/zh/CN/33.512/116.174",
            "https://weatherkit.apple.com/v2/weather/zh/CN/33.512/116.174"
        ];
        
        for (let url of successfulPatterns) {
            console.log(`发送请求: ${url}`);
            $httpClient.get(url, (error, response) => {
                if (!error) {
                    console.log(`✅ 请求发送: ${response.status}`);
                } else {
                    console.log(`⚠️ 请求失败: ${error}`);
                }
            });
            await this.delay(1000);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 执行强制触发
const trigger = new GPSForceTrigger();

// 检查是否需要触发
const lastGPSUpdate = parseInt($persistentStore.read("last_gps_update") || "0");
const now = Date.now();
const updateThreshold = 10 * 60 * 1000; // 10分钟

if (now - lastGPSUpdate > updateThreshold) {
    console.log("🔄 需要更新GPS数据，开始强制触发");
    trigger.forceTriggerGPS().then(() => {
        $persistentStore.write(now.toString(), "last_gps_update");
        
        // 发送成功通知
        $notification.post(
            "📍 GPS强制触发完成",
            "天气App已重新启动",
            "请检查GPS拦截脚本是否捕获到新坐标"
        );
        
        $done();
    });
} else {
    console.log("⏳ GPS数据仍在有效期内，跳过触发");
    $done();
}