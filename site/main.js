// CyberCat landing page: language switch, OS-aware download links from the latest GitHub release,
// star count, copy buttons, scroll reveal and a screenshot lightbox. Everything degrades to plain links.
;(() => {
  const REPO = 'EdFtem/CyberCat'
  const RELEASES = `https://github.com/${REPO}/releases`
  document.documentElement.classList.add('js')

  // ---------- Language ----------
  // English lives in the HTML; this is the Ukrainian translation
  const uk = {
    skip: 'Перейти до вмісту',
    'nav.features': 'Можливості',
    'nav.docker': 'Docker',
    'nav.security': 'Безпека',
    'nav.download': 'Завантажити',
    'nav.faq': 'Питання',
    'hero.eyebrow': 'Безкоштовно й з відкритим кодом · Windows · macOS · Linux',
    'hero.title': 'Файловий менеджер для тих, хто <em>живе в SSH</em>',
    'hero.lead': 'Дві панелі, передачі з докачуванням, справжній редактор коду, живі логи, термінал і Docker — усе в одному SSH-з’єднанні.',
    'hero.download': 'Завантажити',
    'hero.github': 'Відкрити на GitHub',
    'hero.meta': 'Безкоштовно · Без реєстрації',
    'hero.other': 'Інші системи',
    'chip.resume': 'Продовжує з останнього байта',
    'chip.docker': 'Docker через SSH',
    'chip.sudo': 'sudo одним кліком',
    'trust.telemetry': 'Без телеметрії',
    'trust.keychain': 'Паролі в системному сховищі',
    'trust.hostkeys': 'Сувора перевірка ключів сервера',
    'trust.mit': 'Ліцензія MIT',
    'features.kicker': 'Можливості',
    'features.title': 'Усе, заради чого ви заходите по SSH. В одному вікні.',
    'features.lead': 'CyberCat замінює файловий клієнт, редактор, tail логів і Docker-панель, які ви тримаєте відкритими поруч із терміналом.',
    'f.panes.t': 'Дві панелі без тертя',
    'f.panes.d': 'Локальні й серверні файли поруч, вкладка для кожного сервера. Перетягування, F5 копіює, F6 переміщує, хлібні крихти, фільтр та історія.',
    'f.transfers.t': 'Передачі, що переживуть усе',
    'f.transfers.d': 'Черга з паузою, повтором і продовженням з останнього записаного байта. Зник зв’язок — передача продовжиться після перепідключення.',
    'f.editor.t': 'Справжній редактор коду',
    'f.editor.d': 'Monaco з підсвічуванням синтаксису. Кодування й переноси рядків лишаються як були, збереження атомарне, а якщо файл тим часом змінили, ви про це дізнаєтеся.',
    'f.logs.t': 'Живі логи',
    'f.logs.d': 'Стежте за будь-яким логом через tail -F: рівні кольорами, фільтр, пауза й автопрокрутка.',
    'f.terminal.t': 'Термінал у тій самій сесії',
    'f.terminal.d': 'xterm.js на вже відкритому з’єднанні, одразу в теці, яку ви переглядаєте.',
    'f.docker.t': 'Docker через SSH',
    'f.docker.d': 'Контейнери, образи, томи й compose-проєкти на будь-якому сервері з SSH. Логи, shell усередині контейнера, живі CPU і пам’ять.',
    'f.sudo.t': 'sudo одним кліком',
    'f.sudo.d': 'Переглядайте й редагуйте від root через окремий SFTP-канал. Червона рамка панелі нагадує, що режим увімкнено.',
    'f.sync.t': 'Порівняння й синхронізація тек',
    'f.sync.d': 'За розміром, датою або sha256, у будь-який бік або «новіше перемагає». Перегляньте план, а потім режим стеження відвантажуватиме зміни щойно ви зберігаєте.',
    'f.tunnels.t': 'Тунелі портів',
    'f.tunnels.d': 'Клік по опублікованому порту контейнера відкриває його у браузері через SSH-тунель.',
    'f.search.t': 'Пошук на сервері',
    'f.search.d': 'За назвою через find і за вмістом через grep, з переходом просто до файлу.',
    'f.config.t': 'Ваш ssh config — за один клік',
    'f.config.d': 'Хости, користувачі, ключі та ланцюжки ProxyJump з ~/.ssh/config. Паролі, ключі й агенти: OpenSSH або Pageant.',
    'f.power.t': 'Інструменти для досвідчених',
    'f.power.d': 'Масове перейменування з regex або шаблоном, власні команди в контекстному меню, закладки і кожна дія з клавіатури.',
    's.editor.k': 'Редактор',
    's.editor.t': 'Редагуйте на сервері, як локально',
    's.editor.d': 'Відкривайте будь-який файл у вбудованому редакторі Monaco. CyberCat зберігає початкове кодування й переноси рядків, пише атомарно і зупинить вас, перш ніж ви перезапишете чужі зміни. Любите свій редактор? Файл відкриється там і завантажуватиметься на сервер при кожному збереженні.',
    's.editor.1': 'UTF-8, UTF-8 з BOM і Windows-1251 зберігаються',
    's.editor.2': 'Виявлення конфліктів за часом зміни',
    's.editor.3': 'Зовнішній редактор з автоматичним завантаженням',
    's.docker.k': 'Docker',
    's.docker.t': 'Ваші контейнери без ще однієї панелі',
    's.docker.d': 'CyberCat працює з docker і podman через SSH-сесію, яка вже відкрита. Compose-проєкти запускаються, перезапускаються, оновлюються й зупиняються одним кліком, контейнери показують живі CPU і пам’ять, а опубліковані порти відкриваються у браузері через тунель.',
    's.docker.1': 'Логи й shell усередині будь-якого контейнера',
    's.docker.2': 'Зручний inspect з переходом до bind mount на хості',
    's.docker.3': 'Прибирання образів без тегу й невикористаних томів',
    's.docker.4': 'Працює через sudo, якщо сокет доступний лише root',
    's.logs.k': 'Живі логи',
    's.logs.t': 'Дивіться логи в реальному часі',
    's.logs.d': 'Стежте за будь-яким файлом через tail -F у псевдотерміналі. Помилки й попередження вирізняються, фільтр звужує тисячі рядків до потрібних, а пауза тримає місце, поки нові рядки чекають у черзі.',
    's.logs.1': 'Помилки, попередження й debug власними кольорами',
    's.logs.2': 'Фільтр, пауза й автопрокрутка',
    's.logs.3': 'На серверах без shell — опитування через SFTP',
    's.sync.k': 'Синхронізація',
    's.sync.t': 'Синхронізуйте теки свідомо',
    's.sync.d': 'Порівняйте локальну теку з сервером і побачте, що саме станеться, ще до того, як щось зрушить. За потреби дзеркальте видалення, а потім увімкніть стеження, і зміни відвантажуватимуться щойно ви зберігаєте.',
    's.sync.1': 'Локально → сервер, сервер → локально або «новіше перемагає»',
    's.sync.2': 'Попередній план із дією для кожного файлу',
    's.sync.3': 'Порівняння за розміром, датою або sha256',
    'days.kicker': 'Комфорт',
    'days.title': 'Для довгих днів на серверах',
    'days.theme.t': 'Світла або темна',
    'days.theme.d': 'Обидві теми вивірені за контрастністю, аж до найтьмянішого підпису.',
    'days.lang.t': 'Англійська або українська',
    'days.lang.d': 'Мова перемикається в налаштуваннях без перезапуску. Додати ще одну — це одна тека з рядками.',
    'days.keys.t': 'Спершу клавіатура',
    'days.keys.d': 'Функціональні клавіші з класичних файлових менеджерів, а повний список — на F1.',
    'sec.kicker': 'Безпека',
    'sec.title': 'Ваші ключі лишаються вашими',
    'sec.telemetry.t': 'Без телеметрії',
    'sec.telemetry.d': 'Ні аналітики, ні облікових записів. Окрім ваших SSH-з’єднань, єдиний запит — перевірка оновлень на GitHub, і її можна вимкнути.',
    'sec.keychain.t': 'Системне сховище',
    'sec.keychain.d': 'Збережені паролі шифрує сховище облікових даних вашої ОС. Приватні ключі читаються з диска лише під час підключення.',
    'sec.hostkeys.t': 'Сувора перевірка ключів',
    'sec.hostkeys.d': 'Відбиток нового сервера запам’ятовується при першому підключенні, а змінений зупинить вас чітким попередженням.',
    'sec.open.t': 'Відкритий код',
    'sec.open.d': 'Кожен рядок — на GitHub під ліцензією MIT. Читайте, збирайте, змінюйте.',
    'dl.kicker': 'Завантажити',
    'dl.title': 'Отримати CyberCat',
    'dl.lead': 'Безкоштовно для Windows, macOS і Linux.',
    'dl.soon': 'Перший публічний реліз уже на підході. А поки можна зібрати застосунок з коду за кілька хвилин, див. нижче.',
    'dl.win.req': '10 і 11',
    'dl.win.installer': 'Інсталятор',
    'dl.win.portable': 'Портативний .exe',
    'dl.win.note': 'Оновлюється сам. Під час першого запуску SmartScreen може попередити: натисніть «Докладніше», потім «Усе одно запустити».',
    'dl.mac.req': 'Apple Silicon та Intel',
    'dl.mac.arm': 'Apple Silicon',
    'dl.mac.intel': 'Intel',
    'dl.mac.note': 'Перенесіть CyberCat у «Програми» й один раз виконайте цю команду, бо застосунок ще не нотаризований Apple:',
    'dl.linux.req': 'x64 AppImage',
    'dl.linux.note': 'Оновлюється сам. Зробіть файл виконуваним і запустіть:',
    'dl.source': 'Зібрати з коду',
    'dl.source.note': 'Потрібен Node.js 22 або новіший. npm run dist збирає інсталятор для вашої системи.',
    'dl.all': 'Усі релізи й контрольні суми',
    'faq.kicker': 'Питання',
    'faq.title': 'Відповіді на питання',
    'faq.free.q': 'CyberCat справді безкоштовний?',
    'faq.free.a': 'Так. Він з відкритим кодом під ліцензією MIT, без облікових записів, реклами й платних тарифів.',
    'faq.data.q': 'Він кудись надсилає дані?',
    'faq.data.a': 'Телеметрії немає. Окрім SSH-з’єднань, які ви відкриваєте, CyberCat лише перевіряє оновлення на GitHub Releases, і це можна вимкнути в Налаштуваннях → Оновлення.',
    'faq.servers.q': 'З якими серверами він працює?',
    'faq.servers.a': 'З будь-яким SSH-сервером із SFTP, наприклад OpenSSH на Linux, BSD чи macOS. Файлові операції працюють через звичайний SFTP; терміналу, пошуку на сервері, живим логам, sudo-режиму й Docker потрібен ще й доступ до shell.',
    'faq.warning.q': 'Чому система попереджає під час першого запуску?',
    'faq.warning.a': 'Збірки поки не підписані платними сертифікатами. У Windows виберіть «Докладніше», потім «Усе одно запустити»; на macOS один раз виконайте команду xattr з розділу завантаження.',
    'faq.updates.q': 'Як працюють оновлення?',
    'faq.updates.a': 'CyberCat перевіряє GitHub невдовзі після запуску й далі кожні шість годин. У Windows і Linux оновлення завантажується у фоні й встановлюється під час перезапуску. На macOS застосунок повідомить про нову версію й відкриє сторінку завантаження.',
    'faq.passwords.q': 'Де зберігаються мої паролі?',
    'faq.passwords.a': 'Лише якщо ви вирішите їх зберегти — зашифрованими сховищем облікових даних вашої ОС. SSH-агенти й ключі з паролем теж працюють.',
    'faq.help.q': 'Можна допомогти?',
    'faq.help.a': 'Будь ласка! Звіти про помилки, ідеї й pull requests чекають на <a href="https://github.com/EdFtem/CyberCat" target="_blank" rel="noopener">GitHub</a>, а нова мова інтерфейсу — це одна тека з рядками.',
    'final.title': 'Дайте своїм серверам краще вікно',
    'final.download': 'Завантажити CyberCat',
    'final.star': 'Зірочка на GitHub',
    'footer.releases': 'Релізи',
    'footer.issues': 'Питання й баги',
    'footer.contributing': 'Як долучитися',
    'footer.security': 'Безпека',
    'footer.license': '© 2026 Eduard Ftemov · Ліцензія MIT',
    // strings built in JavaScript
    'js.downloadFor': 'Завантажити для {os}',
    'js.getDesktop': 'Завантажити для комп’ютера',
    'js.released': 'Версія {v} · {date}',
    'js.meta': 'Версія {v} · {arch}{size}',
    'js.intelMac': 'Mac з Intel?',
    'js.copied': 'Скопійовано'
  }
  const en = {
    'js.downloadFor': 'Download for {os}',
    'js.getDesktop': 'Download for desktop',
    'js.released': 'Version {v} · {date}',
    'js.meta': 'Version {v} · {arch}{size}',
    'js.intelMac': 'Intel Mac?',
    'js.copied': 'Copied'
  }
  const originals = new Map()
  for (const el of document.querySelectorAll('[data-i18n]')) originals.set(el, ['text', el.textContent])
  for (const el of document.querySelectorAll('[data-i18n-html]')) originals.set(el, ['html', el.innerHTML])

  let lang = 'en'
  const t = (key, vars = {}) => {
    const s = (lang === 'uk' ? uk[key] : en[key]) ?? en[key] ?? key
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  }

  function setLang(next) {
    lang = next === 'uk' ? 'uk' : 'en'
    document.documentElement.lang = lang
    for (const [el, [kind, original]] of originals) {
      const key = el.dataset.i18n ?? el.dataset.i18nHtml
      const value = lang === 'uk' ? uk[key] : undefined
      if (kind === 'html') el.innerHTML = value ?? original
      else el.textContent = value ?? original
    }
    for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang))
    try {
      localStorage.setItem('cc.lang', lang)
    } catch {
      /* private mode or storage blocked */
    }
    renderDownloads()
  }

  // ---------- Platform detection ----------
  const ua = navigator.userAgent
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
  const os = /iPhone|iPad|Android/i.test(ua)
    ? 'mobile'
    : /Mac/i.test(platform) || /Macintosh/.test(ua)
      ? 'mac'
      : /Win/i.test(platform) || /Windows/.test(ua)
        ? 'windows'
        : /Linux|X11/i.test(platform + ua)
          ? 'linux'
          : 'unknown'
  let macArch = 'arm' // most Macs sold since 2020; refined below where the browser can tell
  if (os === 'mac' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData
      .getHighEntropyValues(['architecture'])
      .then((v) => {
        if (v.architecture === 'x86') macArch = 'intel'
        renderDownloads()
      })
      .catch(() => {})
  }
  document.querySelector(`.platform[data-os="${os}"]`)?.classList.add('current')

  // ---------- Latest release ----------
  let release = null // { version, date, assets: { win, winPortable, macArm, macIntel, linux } }
  const patterns = {
    win: /Setup-.*\.exe$/i,
    winPortable: /portable\.exe$/i,
    macArm: /mac-arm64\.dmg$/i,
    macIntel: /mac-x64\.dmg$/i,
    linux: /\.AppImage$/i
  }
  const mb = (bytes) => `${Math.round(bytes / 1048576)} MB`

  function renderDownloads() {
    const primary = document.querySelector('[data-primary-download]')
    const label = document.querySelector('[data-primary-label]')
    const meta = document.querySelector('[data-primary-meta]')
    const other = document.querySelector('[data-other-platforms]')
    const names = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }
    const key = os === 'mac' ? (macArch === 'intel' ? 'macIntel' : 'macArm') : os === 'windows' ? 'win' : os === 'linux' ? 'linux' : null

    if (label) label.textContent = names[os] ? t('js.downloadFor', { os: names[os] }) : os === 'mobile' ? t('js.getDesktop') : label.textContent
    if (release) {
      for (const a of document.querySelectorAll('[data-asset]')) {
        const asset = release.assets[a.dataset.asset]
        if (asset) a.href = asset.url
      }
      for (const s of document.querySelectorAll('[data-size]')) {
        const asset = release.assets[s.dataset.size]
        s.textContent = asset ? mb(asset.size) : ''
      }
      const badge = document.querySelector('[data-release]')
      if (badge) {
        badge.hidden = false
        badge.textContent = t('js.released', {
          v: release.version,
          date: new Date(release.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        })
      }
      const asset = key && release.assets[key]
      if (primary && asset) {
        primary.href = asset.url
        const arch = os === 'mac' ? (macArch === 'intel' ? 'Intel' : 'Apple Silicon') : os === 'windows' ? 'Windows' : 'AppImage'
        if (meta) meta.textContent = t('js.meta', { v: release.version, arch, size: ` · ${mb(asset.size)}` })
        if (other && os === 'mac') other.textContent = t('js.intelMac')
      }
    }
  }

  async function loadRelease() {
    const noRelease = document.querySelector('[data-no-release]')
    try {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 8000)
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      if (r.status === 404) {
        if (noRelease) noRelease.hidden = false
        return
      }
      if (!r.ok) return
      const data = await r.json()
      const assets = {}
      for (const [k, re] of Object.entries(patterns)) {
        const a = (data.assets || []).find((x) => re.test(x.name))
        if (a) assets[k] = { url: a.browser_download_url, size: a.size }
      }
      release = { version: String(data.tag_name || '').replace(/^v/, ''), date: data.published_at, assets }
      renderDownloads()
    } catch {
      /* offline or rate-limited: the links keep pointing at the releases page */
    }
  }

  async function loadStars() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}`)
      if (!r.ok) return
      const { stargazers_count: n } = await r.json()
      const el = document.querySelector('[data-stars]')
      if (el && n > 0) {
        el.querySelector('b').textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
        el.hidden = false
      }
    } catch {
      /* ignore */
    }
  }

  // ---------- Copy buttons ----------
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code')
      try {
        await navigator.clipboard.writeText(code.textContent)
        btn.classList.add('copied')
        btn.setAttribute('aria-label', t('js.copied'))
        setTimeout(() => btn.classList.remove('copied'), 1600)
      } catch {
        const range = document.createRange()
        range.selectNodeContents(code)
        const sel = getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    })
  }

  // ---------- Lightbox ----------
  const box = document.querySelector('.lightbox')
  const boxImg = box?.querySelector('img')
  for (const img of document.querySelectorAll('img[data-zoom]')) {
    img.addEventListener('click', () => {
      if (!box || typeof box.showModal !== 'function') return
      boxImg.src = img.currentSrc || img.src
      boxImg.alt = img.alt
      box.showModal()
    })
  }
  box?.addEventListener('click', (e) => {
    if (e.target === box || e.target.closest('.lightbox-close')) box.close()
  })

  // ---------- Scroll effects ----------
  const nav = document.querySelector('.nav')
  const onScroll = () => nav?.classList.toggle('scrolled', scrollY > 8)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  const revealables = document.querySelectorAll('.reveal')
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    revealables.forEach((el) => io.observe(el))
  } else {
    revealables.forEach((el) => el.classList.add('in'))
  }

  // ---------- Start ----------
  for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang))
  let initial = new URLSearchParams(location.search).get('lang')
  if (!initial) {
    try {
      initial = localStorage.getItem('cc.lang')
    } catch {
      /* ignore */
    }
  }
  if (!initial) initial = (navigator.language || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
  setLang(initial)
  loadRelease()
  loadStars()
})()
