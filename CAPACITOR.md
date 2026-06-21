# دليل تطبيق الجوال (Capacitor)

تم إعداد المشروع ليعمل كتطبيق أصلي على Android و iOS مع **التحديث التلقائي** —
عند فتح التطبيق يُحمّل دائمًا أحدث نسخة منشورة من الويب تلقائيًا (عبر `server.url`
في `capacitor.config.ts`)، فلا حاجة لإعادة رفعه للمتاجر عند كل تعديل.

## أول مرة (على جهازك)

```bash
# 1) صدّر المشروع إلى GitHub ثم اسحبه (git pull) وثبّت الحزم
npm install

# 2) أضف المنصّات
npx cap add android
npx cap add ios     # يتطلب جهاز Mac + Xcode

# 3) ابنِ وزامن
npm run build
npx cap sync

# 4) شغّل
npx cap run android
npx cap run ios
```

بعد أي `git pull` لاحق: `npm install` ثم `npx cap sync`.

## الأذونات المطلوبة (تُضاف مرة واحدة بعد `cap add`)

### Android — `android/app/src/main/AndroidManifest.xml`
أضف داخل `<manifest>` قبل `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### iOS — `ios/App/App/Info.plist`
أضف المفاتيح التالية (نصوص الشرح تظهر للمستخدم):

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>نحتاج موقعك لتتبّع المواقع الميدانية مباشرةً.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>نحتاج موقعك في الخلفية لمتابعة الفرق الميدانية باستمرار.</string>
<key>NSMicrophoneUsageDescription</key>
<string>نحتاج الميكروفون لإرسال الرسائل الصوتية (اللاسلكي).</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>audio</string>
  <string>remote-notification</string>
  <string>fetch</string>
</array>
```

> بعد تعديل هذه الملفات، شغّل `npx cap sync` مجددًا.

## مزيد من التفاصيل
راجع مقال Lovable حول تطوير الجوال بـ Capacitor:
https://lovable.dev/blog/mobile-app-with-capacitor
