// js/i18n.js

export let currentLang = localStorage.getItem('online_cat_lang') || (navigator.language.startsWith('ko') ? 'ko' : 'en');

export const translations = {
  ko: {
    // UI Elements
    app_title: "Online Cat",
    login: "🔑<span class=\"auth-text\"> 로그인</span>",
    logout: "🚪<span class=\"auth-text\"> 로그아웃</span>",
    hide_ui: "👁️",
    show_ui: "👁️",
    take_photo: "📷",
    take_photo_title: "사진 찍기 (화면 캡처)",
    settings: "⚙️",
    settings_title: "환경 설정",
    volume_on_off: "🔊",
    volume_title: "소리 켜기/끄기",
    add_cat: "➕",
    add_cat_title: "고양이 만들기",
    settings_header: "🌸 환경 설정",
    settings_time: "시간대 설정 (배경 테마)",
    time_morning: "아침",
    time_afternoon: "낮",
    time_evening: "저녁",
    time_night: "밤",
    settings_weather: "날씨 설정 (이펙트)",
    weather_calm: "평온함",
    weather_sakura: "벚꽃",
    weather_rain: "비/천둥",
    settings_sound: "효과음 볼륨",
    settings_lang: "언어 설정 (Language)",
    cat_details_header: "🏷️ 고양이 정보",
    cat_gender_male: "수컷 ♂",
    cat_gender_female: "암컷 ♀",
    cat_gender: "성별",
    cat_breed: "묘종",
    cat_stat_affection: "❤️ 친밀도",
    cat_stat_energy: "⚡ 에너지",
    cat_stat_hunger_label: "🐟 배고픔",
    rename: "📝 이름변경",
    release: "💝 입양 보내기",
    camera_track: "🎥 카메라 추적",
    tracking_hud: "🎥 <strong>{name}</strong> 추적 중",
    stop_tracking: "추적 해제",
    guide_pet: "🐾 마우스로 고양이를 쓰다듬어(Pet) 보세요!",
    obs_hud_title: "🔍 관찰 모드",
    obs_send_back: "🏡 방으로 보내기",
    creator_header: "🐱 고양이 만들기",
    creator_sub: "나만의 귀여운 단짝을 만들어보세요.",
    creator_name_label: "고양이 이름",
    creator_name_placeholder: "고양이 이름을 적어주세요...",
    creator_breed_label: "묘종 선택",
    creator_adopt_btn: "새로운 고양이 입양하기 ✨",
    realtime_log_header: "실시간 로그",
    realtime_log_welcome: "온라인 고양이 안식처에 오신 것을 환영합니다!",
    toy_yarn: "털실뭉치",
    toy_box: "골판지상자",
    toy_treat: "물고기간식",
    toy_clear: "장난감청소",
    toy_laser: "레이저",
    toy_laser_desc: "🔦 레이저 포인터: 마우스 빨간 점을 고양이가 쫓아다닙니다.",
    toy_yarn_desc: "🧶 털실 뭉치: 던져서 고양이가 쫓아가 노는 장난감입니다.",
    toy_box_desc: "📦 골판지 상자: 바닥에 놓으면 고양이가 들어가 쉴 수 있습니다.",
    toy_treat_desc: "🐟 물고기 간식: 바닥에 놓아 고양이에게 먹이는 과자입니다.",
    toy_clear_desc: "🧹 장난감 청소: 활성화 후 장난감을 클릭해 치웁니다. (더블 클릭 시 전체 청소)",
    login_header: "🔑 로그인 및 회원가입",
    login_sub: "계정을 등록하거나 로그인하면 내 고양이가 저장되어 언제 접속해도 만날 수 있어요.",
    login_email: "이메일 주소",
    login_password: "비밀번호",
    login_password_placeholder: "6자리 이상 비밀번호",
    login_btn: "이메일 로그인",
    signup_btn: "이메일 회원가입",
    or: "또는",
    google_login: "구글 계정으로 로그인",
    photo_header: "📷 찰칵! 고양이 사진첩",
    photo_sub: "방금 촬영된 고양이 사진입니다. 이미지를 저장하거나 소장해 보세요!",
    photo_save: "💾 사진 저장하기",
    photo_close: "닫기",

    // Breeds
    breed_tabby: "치즈/실버 태비",
    breed_tuxedo: "턱시도 고양이",
    breed_calico: "삼색 고양이",
    breed_siamese: "샴 고양이",
    breed_ginger: "치즈 태비",
    breed_black: "올블랙 고양이",
    breed_white: "하얀 고양이",
    breed_grey: "러시안 블루",
    breed_scottish: "스코티시 폴드",
    breed_sphynx: "스핑크스 고양이",

    // Logs & Alerts (Dynamic)
    log_spawn_yarn: "바닥에 🧶 털실 뭉치를 놓았습니다.",
    log_spawn_box: "바닥에 📦 골판지 상자를 놓았습니다.",
    log_spawn_treat: "바닥에 🐟 물고기 간식을 놓았습니다.",
    log_spawn_toy: "바닥에 장난감을 놓았습니다.",
    log_clear_old: "정리가 필요해 오래된 장난감을 치웠습니다.",
    log_clear_no_toys: "치울 장난감이 없습니다.",
    log_clear_all: "🧹 방 안의 모든 장난감과 상자를 깨끗이 치웠습니다.",
    log_clear_individual: "바닥에 놓인 {name}을(를) 치웠습니다.",
    log_laser_on: "🔦 레이저 포인터를 켰습니다. 마우스를 따라 다닙니다.",
    log_laser_off: "🔦 레이저 포인터를 껐습니다.",
    log_pet_lift: "🖐️ <strong>{name}</strong>를 안아 올렸습니다.",
    log_obs_start: "🔍 <strong>{name}</strong> 관찰 모드가 시작되었습니다. 쓰다듬어(Pet) 보세요!",
    log_obs_end: "🏡 <strong>{name}</strong>(이)가 다시 방으로 돌아갔습니다.",
    log_name_changed: "📝 <strong>{oldName}</strong>(이)의 이름이 <strong>{newName}</strong>(으)로 변경되었습니다.",
    log_adopt_success: "💖 새로운 묘종(<strong>{breed}</strong>)인 <strong>{name}</strong>(이)가 안식처에 찾아왔습니다!",
    log_release_success: "🐾 <strong>{name}</strong>(이)가 따뜻한 가정으로 입양을 떠났습니다. 행복하렴!",
    log_login_success: "🔑 계정({email})으로 로그인했습니다.",
    log_session_loaded: "🔑 기존 세션({email})을 불러왔습니다.",
    log_logout_success: "🚪 계정에서 로그아웃했습니다.",
    log_default_message: "모카, 코코, 라떼 세 고양이가 한가롭게 노닐고 있습니다. 쓰다듬어보세요!",
    log_photo_saved: "💾 고양이 사진을 파일로 저장했습니다.",
    log_signup_pending: "☁️ 회원가입을 요청 중입니다...",
    log_signup_failed: "❌ 회원가입 실패: {msg}",
    log_signup_email_sent: "✉️ 이메일 인증 메일이 발송되었습니다.",
    log_login_pending: "☁️ 로그인을 요청 중입니다...",
    log_login_failed: "❌ 로그인 실패: {msg}",
    log_google_pending: "☁️ 구글 로그인 창으로 이동 중...",
    log_cats_loaded: "☁️ 저장된 고양이 {count}마리를 불러왔습니다.",
    log_cats_loaded_local: "📦 저장된 고양이 {count}마리를 불러왔습니다.",
    log_cats_loaded_toys: "📦 저장된 장난감 {count}개를 불러왔습니다.",
    log_cat_surprise: "💥 <strong>{name}</strong>(이)가 날아온 털뭉치에 맞고 깜짝 놀랐습니다!",

    // Cat States (Logs)
    cat_state_sleep: "📦 골판지 상자 속으로 쏙 들어가서 낮잠을 잡니다. zZ",
    cat_state_sleep_default: "낮잠을 잡니다. zZ",
    cat_state_eat: "🐟 물고기 간식을 냠냠 먹습니다.",
    cat_state_play: "🧶 털실 뭉치를 툭툭 굴리며 놉니다.",
    cat_state_pet: "골골송을 부르며 기분이 아주 좋습니다. ♪",

    // UI Dialogs
    alert_name_required: "고양이 이름을 지어주세요!",
    alert_sanctuary_full: "안식처가 꽉 찼습니다! (최대 6마리)\n일부 고양이를 입양 보낸 뒤 데려와 주세요.",
    alert_slot_limit_reached: "더 이상 고양이를 입양할 공간이 없습니다 (최대 {limit}마리).\n광고를 5초간 시청하고 고양이 슬롯을 1칸 추가하시겠습니까?",
    alert_adblock_detected: "광고 차단(Adblock) 프로그램이 감지되었습니다. 고양이 슬롯을 추가하려면 광고 차단 설정을 해제하고 새로고침해 주세요.",
    ad_modal_title: "📺 광고 시청 중",
    ad_modal_status: "광고가 완료될 때까지 잠시만 기다려주세요...",
    ad_complete: "🎉 광고 시청이 완료되어 고양이 슬롯이 1칸 추가되었습니다!",
    log_slot_unlocked: "🔓 광고 시청으로 고양이 슬롯을 추가했습니다! (최대 {limit}마리)",
    alert_adopt_out_confirm: "{name}를 좋은 곳으로 입양 보낼까요?\n언제든 새로운 고양이를 다시 데려올 수 있어요.",
    prompt_rename: "새로운 이름을 지어주세요 (최대 8자):",
    alert_signup_success: "회원가입 및 로그인에 성공했습니다!",
    alert_signup_email_verify: "회원가입 완료! 메일함(또는 스팸함)에서 인증 이메일을 확인해 주세요.",
    alert_login_success: "로그인에 성공했습니다!",
    alert_error: "오류 발생: {msg}",
    alert_signup_failed_dialog: "회원가입 실패: {msg}",
    alert_login_failed_dialog: "로그인 실패: {msg}",
    alert_google_failed_dialog: "구글 로그인 오류: {msg}",
    alert_cats_load_failed: "⚠️ 고양이 데이터를 불러오는데 실패했습니다: {msg}",
    log_broom_on: "🧹 빗자루 모드가 활성화되었습니다. 바닥의 장난감을 클릭하여 개별적으로 치울 수 있습니다. (더블 클릭 시 전체 청소)",
    log_broom_off: "🧹 빗자루 모드를 비활성화했습니다.",
    log_sound_muted: "🔊 사운드가 음소거 되었습니다.",
    log_sound_unmuted: "🔊 사운드가 켜졌습니다.",
    log_time_changed: "시간을 <strong>{time}</strong> 테마로 변경했습니다.",
    log_weather_changed: "날씨를 <strong>{weather}</strong> 효과로 설정했습니다.",
    log_cat_state: "<strong>{name}</strong>(이)가 {msg}",
    logged_in_as: "로그인 계정: {email}",
    alert_photo_failed: "사진 촬영에 실패했습니다: {msg}",
    alert_supabase_init_failed: "Supabase 클라이언트 초기화에 실패했습니다. 올바른 Anon Key를 입력했는지 확인해 주세요.",
    alert_input_email_password: "이메일과 비밀번호를 모두 입력해 주세요.",
    alert_password_min_len: "비밀번호는 최소 6자 이상이어야 합니다.",
    prompt_supabase_key: "Supabase Anon Key를 입력해 주세요 (최초 1회 저장):\n대시보드 > Project Settings > API > anon public key 에서 복사할 수 있습니다.",
    confirm_logout: "계정에서 로그아웃하시겠습니까?",
    app_title_seo: "온라인 고양이 힐링 Sanctuary | Online Cat",
    app_desc_seo: "나만의 고양이를 입양하고, 만져주고, 장난감으로 함께 놀아주며 힐링하는 온라인 고양이 방입니다."
  },
  en: {
    // UI Elements
    app_title: "Online Cat",
    login: "🔑<span class=\"auth-text\"> Login</span>",
    logout: "🚪<span class=\"auth-text\"> Logout</span>",
    hide_ui: "👁️",
    show_ui: "👁️",
    take_photo: "📷",
    take_photo_title: "Take Photo (Screen Capture)",
    settings: "⚙️",
    settings_title: "Settings",
    volume_on_off: "🔊",
    volume_title: "Volume On/Off",
    add_cat: "➕",
    add_cat_title: "Adopt Cat",
    settings_header: "🌸 Environment Settings",
    settings_time: "Time of Day (Theme)",
    time_morning: "Morning",
    time_afternoon: "Afternoon",
    time_evening: "Evening",
    time_night: "Night",
    settings_weather: "Weather (Effects)",
    weather_calm: "Calm",
    weather_sakura: "Sakura",
    weather_rain: "Rain/Storm",
    settings_sound: "Sound Volume",
    settings_lang: "Language Settings",
    cat_details_header: "🏷️ Cat Profile",
    cat_gender_male: "Male ♂",
    cat_gender_female: "Female ♀",
    cat_gender: "Gender",
    cat_breed: "Breed",
    cat_stat_affection: "❤️ Affection",
    cat_stat_energy: "⚡ Energy",
    cat_stat_hunger_label: "🐟 Hunger",
    rename: "📝 Rename",
    release: "💝 Adopt Out",
    camera_track: "🎥 Camera Track",
    tracking_hud: "🎥 Tracking <strong>{name}</strong>",
    stop_tracking: "Stop Track",
    guide_pet: "🐾 Use mouse to pet the cats!",
    obs_hud_title: "🔍 Observation Mode",
    obs_send_back: "🏡 Send back to room",
    creator_header: "🐱 Adopt a Cat",
    creator_sub: "Create your own cozy companion.",
    creator_name_label: "Cat Name",
    creator_name_placeholder: "Enter cat name...",
    creator_breed_label: "Select Breed",
    creator_adopt_btn: "Adopt New Cat ✨",
    realtime_log_header: "Activity Log",
    realtime_log_welcome: "Welcome to the Online Cat Sanctuary!",
    toy_yarn: "Yarn Ball",
    toy_box: "Cardboard Box",
    toy_treat: "Fish Treat",
    toy_clear: "Clean Toys",
    toy_laser: "Laser",
    toy_laser_desc: "🔦 Laser Pointer: Cats will chase the red laser dot.",
    toy_yarn_desc: "🧶 Yarn Ball: Drag to throw, cats will chase and play.",
    toy_box_desc: "📦 Cardboard Box: Drag to place, cats will hop inside and sleep.",
    toy_treat_desc: "🐟 Fish Treat: Drag to place delicious treats for cats to eat.",
    toy_clear_desc: "🧹 Clean Toys: Click to activate broom, click toys to remove. (Double click to sweep all)",
    login_header: "🔑 Login & Signup",
    login_sub: "Sign up or log in to save your cats and meet them anytime you connect.",
    login_email: "Email Address",
    login_password: "Password",
    login_password_placeholder: "6+ character password",
    login_btn: "Email Login",
    signup_btn: "Email Signup",
    or: "or",
    google_login: "Sign in with Google",
    photo_header: "📷 Snapshot Album",
    photo_sub: "Here is your cat snapshot! Save or download it.",
    photo_save: "💾 Save Photo",
    photo_close: "Close",

    // Breeds
    breed_tabby: "Tabby",
    breed_tuxedo: "Tuxedo",
    breed_calico: "Calico",
    breed_siamese: "Siamese",
    breed_ginger: "Ginger",
    breed_black: "Black",
    breed_white: "White",
    breed_grey: "Russian Blue",
    breed_scottish: "Scottish Fold",
    breed_sphynx: "Sphynx",

    // Logs & Alerts (Dynamic)
    log_spawn_yarn: "Placed a 🧶 Yarn Ball on the floor.",
    log_spawn_box: "Placed a 📦 Cardboard Box on the floor.",
    log_spawn_treat: "Placed a 🐟 Fish Treat on the floor.",
    log_spawn_toy: "Placed a toy on the floor.",
    log_clear_old: "Cleared old toys to tidy up the room.",
    log_clear_no_toys: "There are no toys to clean.",
    log_clear_all: "🧹 Swept the room clean of all toys and boxes.",
    log_clear_individual: "Removed the placed {name} from the floor.",
    log_laser_on: "🔦 Turned on the laser pointer. It follows your cursor.",
    log_laser_off: "🔦 Turned on the laser pointer off.",
    log_pet_lift: "🖐️ Picked up <strong>{name}</strong>.",
    log_obs_start: "🔍 Started observing <strong>{name}</strong>. Try petting them!",
    log_obs_end: "🏡 <strong>{name}</strong> has returned to the room.",
    log_name_changed: "📝 Renamed <strong>{oldName}</strong> to <strong>{newName}</strong>.",
    log_adopt_success: "💖 Adopted a new <strong>{breed}</strong> named <strong>{name}</strong>!",
    log_release_success: "🐾 <strong>{name}</strong> has been adopted out to a warm home. Be happy!",
    log_login_success: "🔑 Logged in as {email}.",
    log_session_loaded: "🔑 Restored previous session ({email}).",
    log_logout_success: "🚪 Logged out of your account.",
    log_default_message: "Mocha, Coco, and Latte are playing peacefully. Try petting them!",
    log_photo_saved: "💾 Saved the cat photo to your files.",
    log_signup_pending: "☁️ Requesting signup...",
    log_signup_failed: "❌ Signup failed: {msg}",
    log_signup_email_sent: "✉️ A verification email has been sent.",
    log_login_pending: "☁️ Logging in...",
    log_login_failed: "❌ Login failed: {msg}",
    log_google_pending: "☁️ Redirecting to Google Login...",
    log_cats_loaded: "☁️ Loaded {count} cats from cloud database.",
    log_cats_loaded_local: "📦 Loaded {count} cats from local storage.",
    log_cats_loaded_toys: "📦 Loaded {count} toys from local storage.",
    log_cat_surprise: "💥 <strong>{name}</strong> was hit by a flying yarn ball and got startled!",

    // Cat States (Logs)
    cat_state_sleep: "curled up inside the cardboard box for a cozy nap. zZ",
    cat_state_sleep_default: "is taking a cozy nap. zZ",
    cat_state_eat: "is eating a delicious 🐟 fish treat.",
    cat_state_play: "is playing and rolling the 🧶 yarn ball.",
    cat_state_pet: "is purring and feeling very happy. ♪",

    // UI Dialogs
    alert_name_required: "Please give the cat a name!",
    alert_sanctuary_full: "The sanctuary is full! (Max 6 cats)\nPlease adopt some cats out first.",
    alert_slot_limit_reached: "Not enough space to adopt more cats (max {limit}).\nWould you like to watch a 5-second ad to unlock 1 more slot?",
    alert_adblock_detected: "Adblock detected! Please disable your adblocker and refresh the page to unlock more cat slots.",
    ad_modal_title: "📺 Watching Ad",
    ad_modal_status: "Please wait until the ad is complete...",
    ad_complete: "🎉 Ad watched successfully! 1 cat slot unlocked!",
    log_slot_unlocked: "🔓 Unlocked a new cat slot by watching an ad! (Max {limit} cats)",
    alert_adopt_out_confirm: "Would you like to adopt out {name} to a good home?\nYou can always bring in new cats anytime.",
    prompt_rename: "Please enter a new name (Max 8 characters):",
    alert_signup_success: "Signed up and logged in successfully!",
    alert_signup_email_verify: "Signup complete! Please check your verification email.",
    alert_login_success: "Logged in successfully!",
    alert_error: "Error: {msg}",
    alert_signup_failed_dialog: "Signup failed: {msg}",
    alert_login_failed_dialog: "Login failed: {msg}",
    alert_google_failed_dialog: "Google Login Error: {msg}",
    alert_cats_load_failed: "⚠️ Failed to load cat data: {msg}",
    log_broom_on: "🧹 Broom mode activated. Click toys on the floor to remove them individually. (Double click to sweep all)",
    log_broom_off: "🧹 Broom mode deactivated.",
    log_sound_muted: "🔊 Sound muted.",
    log_sound_unmuted: "🔊 Sound unmuted.",
    log_time_changed: "Changed time theme to <strong>{time}</strong>.",
    log_weather_changed: "Set weather effect to <strong>{weather}</strong>.",
    log_cat_state: "<strong>{name}</strong> {msg}",
    logged_in_as: "Logged in as: {email}",
    alert_photo_failed: "Failed to take photo: {msg}",
    alert_supabase_init_failed: "Failed to initialize Supabase client. Please check if you entered the correct Anon Key.",
    alert_input_email_password: "Please enter both email and password.",
    alert_password_min_len: "Password must be at least 6 characters.",
    prompt_supabase_key: "Please enter your Supabase Anon Key (Saved once initially):\nYou can copy it from Dashboard > Project Settings > API > anon public key.",
    confirm_logout: "Are you sure you want to log out?",
    app_title_seo: "Online Cat Healing Sanctuary | Online Cat",
    app_desc_seo: "Adopt your own cat, pet them, play with toys, and relax in this online cat room."
  }
};

export function t(key, variables = {}) {
  const dictionary = translations[currentLang] || translations['en'];
  let text = dictionary[key] || translations['en'][key] || key;
  
  // Replace placeholders like {name} or {count}
  Object.keys(variables).forEach(k => {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), variables[k]);
  });
  
  return text;
}

export function applyTranslations() {
  // Translate standard textContent elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.innerHTML = t(key);
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = t(key);
  });

  // Translate titles (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    el.title = t(key);
  });
}

export function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('online_cat_lang', lang);
  
  // Set HTML language attribute
  document.documentElement.lang = currentLang;
  
  // Re-apply translations to all elements
  applyTranslations();
  
  // Update document title and description
  document.title = t('app_title_seo');
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) {
    descMeta.setAttribute('content', t('app_desc_seo'));
  }
}
