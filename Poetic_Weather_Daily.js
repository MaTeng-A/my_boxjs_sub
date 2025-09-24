// 名称: 诗意天气日报
// 作者: Assistant
// 描述: 结合彩云天气和天行数据的详细天气报告

// 从BoxJS获取配置 - 使用与JSON配置完全匹配的键名
const caiyunToken = $persistentStore.read("caiyun_token");
const tencentToken = $persistentStore.read("tencent_token");
const tianapiKey1 = $persistentStore.read("tianapi_key1");
const tianapiKey2 = $persistentStore.read("tianapi_key2");

// 调试信息（可选，完成后可以删除）
console.log(`配置读取结果:
彩云Token: ${caiyunToken ? '已配置' : '未配置'}
腾讯Token: ${tencentToken ? '已配置' : '未配置'}
天行Key1: ${tianapiKey1 ? '已配置' : '未配置'} 
天行Key2: ${tianapiKey2 ? '已配置' : '未配置'}`);

// 检查必要的配置
if (!caiyunToken || !tianapiKey1 || !tianapiKey2) {
  const missing = [];
  if (!caiyunToken) missing.push("彩云天气Token");
  if (!tianapiKey1) missing.push("天行数据Key1");
  if (!tianapiKey2) missing.push("天行数据Key2");
  
  $notification.post(
    "天气脚本配置不完整", 
    `请先在BoxJS中配置以下项:`, 
    missing.join(", ")
  );
  $done();
}

// 使用默认的腾讯Token（如果用户没有配置）
const finalTencentToken = tencentToken || "AHEBZ-ASTWX-CIW4P-7TV7T-AWKLS-7CFWP";

// 主函数
function main() {
  // 获取位置信息
  const locationUrl = `https://apis.map.qq.com/ws/location/v1/ip?key=${finalTencentToken}`;
  
  $httpClient.get(locationUrl, function(error, response, data) {
    if (error) {
      handleError("位置获取失败", error);
      return;
    }
    
    try {
      const locationData = JSON.parse(data);
      if (locationData.status === 0) {
        const lat = locationData.result.location.lat;
        const lng = locationData.result.location.lng;
        const city = locationData.result.ad_info.city || locationData.result.ad_info.province;
        
        getCaiyunWeather(lat, lng, city);
      } else {
        handleError("位置获取失败", locationData.message);
      }
    } catch (e) {
      handleError("位置数据解析失败", e.message);
    }
  });
}

function getCaiyunWeather(lat, lng, city) {
  const weatherUrl = `https://api.caiyunapp.com/v2.6/${caiyunToken}/${lng},${lat}/weather?alert=true`;
  
  $httpClient.get(weatherUrl, function(error, response, data) {
    if (error) {
      handleError("天气获取失败", error);
      return;
    }
    
    try {
      const weatherData = JSON.parse(data);
      if (weatherData.status === "ok") {
        getTianapiData(weatherData, city);
      } else {
        handleError("天气获取失败", weatherData.error || "未知错误");
      }
    } catch (e) {
      handleError("天气数据解析失败", e.message);
    }
  });
}

function getTianapiData(weatherData, city) {
  const poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${tianapiKey1}`;
  const morningUrl = `https://api.tianapi.com/zaoan/index?key=${tianapiKey2}`;
  
  // 获取天气诗句
  $httpClient.get(poetryUrl, function(error, response, poetryData) {
    let poetry = null;
    if (!error) {
      try {
        const poetryJson = JSON.parse(poetryData);
        if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
          poetry = poetryJson.newslist[0].content;
        }
      } catch (e) {
        console.log("天气诗句获取失败");
      }
    }
    
    // 获取早安心语
    $httpClient.get(morningUrl, function(error, response, morningData) {
      let morning = null;
      if (!error) {
        try {
          const morningJson = JSON.parse(morningData);
          if (morningJson.code === 200 && morningJson.newslist && morningJson.newslist.length > 0) {
            morning = morningJson.newslist[0].content;
          }
        } catch (e) {
          console.log("早安心语获取失败");
        }
      }
      
      processWeatherData(weatherData, city, poetry, morning);
    });
  });
}

function processWeatherData(weatherData, city, poetry, morning) {
  try {
    const realtime = weatherData.result.realtime;
    const hourly = weatherData.result.hourly;
    
    // 当前天气状况
    const temperature = Math.round(realtime.temperature);
    const apparentTemperature = Math.round(realtime.apparent_temperature);
    const humidity = Math.round(realtime.humidity * 100);
    const windSpeed = Math.round(realtime.wind.speed);
    const windDirection = getWindDirection(realtime.wind.direction);
    const pressure = Math.round(realtime.pressure / 100);
    const visibility = (realtime.visibility / 1000).toFixed(1);
    const skycon = getSkyconDescription(realtime.skycon);
    const pm25 = realtime.air_quality ? Math.round(realtime.air_quality.pm25) : "未知";
    
    // 未来三小时预报
    let hourlyForecast = "⏰ 未来三小时预报:\n";
    for (let i = 0; i < 3 && i < hourly.temperature.length; i++) {
      const hour = new Date(hourly.temperature[i].datetime);
      const hourStr = hour.getHours().toString().padStart(2, '0') + ":00";
      const temp = Math.round(hourly.temperature[i].value);
      const desc = getSkyconDescription(hourly.skycon[i].value);
      
      hourlyForecast += `   ${hourStr} | ${temp}°C | ${desc}\n`;
    }
    
    // 构建通知内容
    let subtitle = `📍${city} | ${temperature}°C | ${skycon}`;
    
    let body = `🌡️ 体感温度: ${apparentTemperature}°C\n`;
    body += `💧 相对湿度: ${humidity}%\n`;
    body += `🌬️ 风力风向: ${windDirection}风 ${windSpeed}km/h\n`;
    body += `📊 大气压强: ${pressure}hPa\n`;
    body += `👁️ 能见度: ${visibility}km\n`;
    body += `🫧 PM2.5: ${pm25}\n\n`;
    body += `${hourlyForecast}\n`;
    
    if (poetry) {
      body += `📜 今日诗语:\n${poetry}\n\n`;
    }
    
    if (morning) {
      body += `🌞 早安寄语:\n${morning}`;
    }
    
    $notification.post("🌤️ 诗意天气日报", subtitle, body);
    $done();
  } catch (e) {
    handleError("天气数据处理失败", e.message);
  }
}

function getWindDirection(degree) {
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 45) % 8;
  return directions[index];
}

function getSkyconDescription(skycon) {
  const skyconMap = {
    "CLEAR_DAY": "☀️ 晴", "CLEAR_NIGHT": "🌙 晴",
    "PARTLY_CLOUDY_DAY": "⛅ 多云", "PARTLY_CLOUDY_NIGHT": "☁️ 多云",
    "CLOUDY": "☁️ 阴", "LIGHT_RAIN": "🌦️ 小雨", "MODERATE_RAIN": "🌧️ 中雨",
    "HEAVY_RAIN": "⛈️ 大雨", "STORM_RAIN": "🌩️ 暴雨", "LIGHT_SNOW": "❄️ 小雪",
    "MODERATE_SNOW": "🌨️ 中雪", "HEAVY_SNOW": "暴雪", "STORM_SNOW": "❄️ 暴雪",
    "FOG": "🌫️ 雾", "WIND": "💨 大风"
  };
  
  return skyconMap[skycon] || "未知";
}

function handleError(title, message) {
  $notification.post("❌ " + title, message, "");
  $done();
}

// 启动主函数
main();
