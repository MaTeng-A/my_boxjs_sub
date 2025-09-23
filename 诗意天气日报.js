```javascript
// 名称: 诗意天气日报
// 作者: Assistant
// 更新时间: 2024-06-01
// 描述: 结合彩云天气和天行数据的详细天气报告，包含未来三小时预报和诗意描述

// 从BoxJS获取配置
const caiyunToken = $persistentStore.read("@caiyun.token.caiyun");
const tencentToken = $persistentStore.read("@caiyun.token.tencent");
const tianapiKey1 = $persistentStore.read("@tianapi.key1");
const tianapiKey2 = $persistentStore.read("@tianapi.key2");

// 检查必要的配置
if (!caiyunToken || !tianapiKey1 || !tianapiKey2) {
  $notification.post("天气脚本配置错误", "请确保已在BoxJS中配置彩云天气Token和天行数据Key", "");
  $done();
}

// 获取位置信息（这里使用IP定位，您也可以使用固定的经纬度）
const locationUrl = `https://apis.map.qq.com/ws/location/v1/ip?key=${tencentToken}`;

$httpClient.get(locationUrl, function(error, response, data) {
  if (error) {
    $notification.post("位置获取失败", "无法获取当前位置信息", error);
    $done();
  } else {
    const locationData = JSON.parse(data);
    if (locationData.status === 0) {
      const lat = locationData.result.location.lat;
      const lng = locationData.result.location.lng;
      const city = locationData.result.ad_info.city;
      
      // 获取彩云天气数据
      getCaiyunWeather(lat, lng, city);
    } else {
      $notification.post("位置获取失败", locationData.message, "");
      $done();
    }
  }
});

function getCaiyunWeather(lat, lng, city) {
  const weatherUrl = `https://api.caiyunapp.com/v2.6/${caiyunToken}/${lng},${lat}/weather?alert=true`;
  
  $httpClient.get(weatherUrl, function(error, response, data) {
    if (error) {
      $notification.post("天气获取失败", "无法从彩云天气获取数据", error);
      $done();
    } else {
      const weatherData = JSON.parse(data);
      if (weatherData.status === "ok") {
        // 获取天行数据（天气诗句和早安心语）
        getTianapiData(weatherData, city);
      } else {
        $notification.post("天气获取失败", weatherData.error, "");
        $done();
      }
    }
  });
}

function getTianapiData(weatherData, city) {
  // 并行获取天行数据的两个API
  const poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${tianapiKey1}`;
  const morningUrl = `https://api.tianapi.com/zaoan/index?key=${tianapiKey2}`;
  
  // 获取天气诗句
  $httpClient.get(poetryUrl, function(error, response, poetryData) {
    if (error) {
      processWeatherData(weatherData, city, null, null);
    } else {
      const poetryJson = JSON.parse(poetryData);
      const poetry = poetryJson.code === 200 && poetryJson.newslist.length > 0 
        ? poetryJson.newslist[0].content : "今日天气宜人，愿您心情舒畅。";
      
      // 获取早安心语
      $httpClient.get(morningUrl, function(error, response, morningData) {
        if (error) {
          processWeatherData(weatherData, city, poetry, null);
        } else {
          const morningJson = JSON.parse(morningData);
          const morning = morningJson.code === 200 && morningJson.newslist.length > 0 
            ? morningJson.newslist[0].content : "早安！愿您拥有美好的一天。";
          
          processWeatherData(weatherData, city, poetry, morning);
        }
      });
    }
  });
}

function processWeatherData(weatherData, city, poetry, morning) {
  const realtime = weatherData.result.realtime;
  const minutely = weatherData.result.minutely;
  const hourly = weatherData.result.hourly;
  const daily = weatherData.result.daily;
  
  // 当前天气状况
  const temperature = Math.round(realtime.temperature);
  const apparentTemperature = Math.round(realtime.apparent_temperature);
  const humidity = Math.round(realtime.humidity * 100);
  const windSpeed = Math.round(realtime.wind.speed);
  const windDirection = getWindDirection(realtime.wind.direction);
  const pressure = Math.round(realtime.pressure / 100);
  const visibility = (realtime.visibility / 1000).toFixed(1);
  const skycon = getSkyconDescription(realtime.skycon);
  const pm25 = Math.round(realtime.air_quality.pm25);
  
  // 未来三小时预报
  let hourlyForecast = "未来三小时预报:\n";
  for (let i = 0; i < 3; i++) {
    const hour = new Date(hourly.temperature[i].datetime);
    const hourStr = hour.getHours().toString().padStart(2, '0') + ":00";
    const temp = Math.round(hourly.temperature[i].value);
    const desc = getSkyconDescription(hourly.skycon[i].value);
    
    hourlyForecast += `${hourStr} ${temp}°C ${desc}\n`;
  }
  
  // 构建通知内容
  let subtitle = `📍${city} | ${temperature}°C | ${skycon}`;
  
  let body = `🌡️ 体感: ${apparentTemperature}°C | 💧湿度: ${humidity}%\n`;
  body += `🌬️ 风力: ${windDirection}风 ${windSpeed}km/h | 📊气压: ${pressure}hPa\n`;
  body += `👁️ 能见度: ${visibility}km | 🫧PM2.5: ${pm25}\n\n`;
  body += `${hourlyForecast}\n`;
  
  if (poetry) {
    body += `📜 ${poetry}\n\n`;
  }
  
  if (morning) {
    body += `🌞 ${morning}`;
  }
  
  $notification.post("天气预报", subtitle, body);
  $done();
}

// 辅助函数：获取风向描述
function getWindDirection(degree) {
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const index = Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 45) % 8;
  return directions[index];
}

// 辅助函数：获取天气状况描述
function getSkyconDescription(skycon) {
  const skyconMap = {
    "CLEAR_DAY": "晴",
    "CLEAR_NIGHT": "晴",
    "PARTLY_CLOUDY_DAY": "多云",
    "PARTLY_CLOUDY_NIGHT": "多云",
    "CLOUDY": "阴",
    "LIGHT_RAIN": "小雨",
    "MODERATE_RAIN": "中雨",
    "HEAVY_RAIN": "大雨",
    "STORM_RAIN": "暴雨",
    "LIGHT_SNOW": "小雪",
    "MODERATE_SNOW": "中雪",
    "HEAVY_SNOW": "大雪",
    "STORM_SNOW": "暴雪",
    "LIGHT_HAZE": "轻度雾霾",
    "MODERATE_HAZE": "中度雾霾",
    "HEAVY_HAZE": "重度雾霾",
    "FOG": "雾",
    "DUST": "浮尘",
    "WIND": "大风"
  };
  
  return skyconMap[skycon] || "未知";
}
```
