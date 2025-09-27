// backend/apps/frontend/static/frontend/js/prompts-data.js

const PROMPT_DATA = {
  want: [
    {
      id: 'want-1',
      // ✨ FIX: Underscore removed from SVG path data
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
      title: 'خلاصه کردن یک متن',
      description: 'یک متن طولانی را به نکات کلیدی آن خلاصه می‌کند.',
      prompt: 'متن زیر را در 3 نکته کلیدی خلاصه کن:\n\n[متن خود را اینجا جای‌گذاری کنید]'
    },
    {
      id: 'want-2',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
      title: 'طوفان فکری برای ایده‌ها',
      description: 'برای یک موضوع مشخص، ایده‌های خلاقانه تولید می‌کند.',
      prompt: '5 ایده خلاقانه برای نام یک کانال یوتیوب با موضوع «آموزش پایتون به زبان ساده» پیشنهاد بده.'
    },
    {
      id: 'want-3',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
      title: 'نوشتن پست شبکه اجتماعی',
      description: 'یک کپشن جذاب برای اینستاگرام یا توییتر می‌نویسد.',
      prompt: 'یک کپشن جذاب برای پستی در اینستاگرام با موضوع «اهمیت یادگیری هوش مصنوعی در سال 2025» بنویس. از 3 هشتگ مرتبط هم استفاده کن.'
    },
  ],
  
  // ✨ FIX: All course items are now complete objects
  use: [
    {
      id: 'course-1',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
      title: 'دوره پرامپت نویسی مقدماتی',
      description: 'اصول گفتگو با هوش مصنوعی برای دریافت بهترین نتایج.',
      url: 'https://pyamooz.com/shop/'
    },
    {
      id: 'course-2',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15A2.5 2.5 0 0 1 9.5 22h-5A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2h5z"></path><path d="M14.5 2h5A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 12 19.5v-15A2.5 2.5 0 0 1 14.5 2z"></path></svg>`,
      title: 'هوش مصنوعی چگونه فکر میکند',
      description: 'آشنایی با مفاهیم پایه‌ای و نحوه کار مدل‌های زبانی.',
      url: 'https://pyamooz.com/shop/'
    },
    {
      id: 'course-3',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
      title: 'مقاله نویسی با هوش مصنوعی',
      description: 'یادگیری تولید محتوای آکادمیک و حرفه‌ای با ابزارهای AI.',
      url: 'https://pyamooz.com/shop/'
    },
    {
      id: 'course-4',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
      title: 'کد نویسی با هوش مصنوعی',
      description: 'افزایش سرعت و کیفیت کدنویسی با کمک دستیارهای هوشمند.',
      url: 'https://pyamooz.com/shop/'
    }
  ],
  
  
  // ✨✨✨ START: NEW DATA FOR CONTACT US ✨✨✨
  make: [
    {
      id: 'make-1',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      title: 'کانال آموزش',
      description: 'به کانال ما بپیوندید و از آخرین آموزش‌ها و نکات با خبر شوید.',
      url: '#'
    },
    {
      id: 'make-2',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
      title: 'ارتباط با برنامه نویس',
      description: 'اشکالات و پیشنهادات فنی خود را مستقیماً با من در میان بگذارید.',
      url: '#'
    },
    {
      id: 'make-3',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
      title: 'رزرو دوره خصوصی (وبینار)',
      description: 'برای آموزش خصوصی یا گروهی به صورت آنلاین، زمان رزرو کنید.',
      url: '#'
    },
    {
      id: 'make-4',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
      title: 'رزرو دوره خصوصی (حضوری)',
      description: 'هماهنگی جهت برگزاری دوره‌های آموزشی در محل شما.',
      url: '#'
    },
    {
      id: 'make-5',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
      title: 'عقد قرارداد سازمانی',
      description: 'برای راهکارهای هوش مصنوعی ویژه سازمان خود با ما تماس بگیرید.',
      url: '#'
    },
    {
      id: 'make-6',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
      title: 'سفارش ماژول اختصاصی',
      description: 'یک قابلیت یا ماژول هوش مصنوعی خاص برای پروژه خود نیاز دارید؟',
      url: '#'
    }
  ]
  // ✨✨✨ END: NEW DATA FOR CONTACT US ✨✨✨
};