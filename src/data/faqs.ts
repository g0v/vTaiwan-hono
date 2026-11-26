export interface FAQ {
  id: string
  question: Translations
  answer: Translations
  details?: DetailTranslations
}

export type Locale = 'zh-TW' | 'en' | 'ja' | 'de'
type Translations = Record<Locale, string>
type DetailTranslations = Record<Locale, string[]>

export const faqs: FAQ[] = [
  {
    id: '1',
    question: {
      'zh-TW': '什麼是 vTaiwan?',
      en: 'What is vTaiwan?',
      ja: 'vTaiwanとは何ですか？',
      de: 'Was ist vTaiwan?',
    },
    answer: {
      'zh-TW': 'vTaiwan 是一個結合線上與線下的公共政策討論平台，旨在透過公民參與和數位工具，促進政府、專家與民眾之間的理性對話，共同形塑更好的政策方案。',
      en: 'vTaiwan is a platform that combines online and offline public policy discussions, aiming to promote rational dialogue between government, experts, and the public, and to jointly shape better policy solutions.',
      ja: 'vTaiwanは、オンラインとオフラインを組み合わせた公共政策討論プラットフォームです。市民参加とデジタルツールを通じて、政府、専門家、市民の理性的な対話を促進し、より良い政策を共に作り上げます。',
      de: 'vTaiwan ist eine Plattform für Diskussionen über öffentliche Politik, die Online- und Präsenzformate verbindet. Durch Bürgerbeteiligung und digitale Werkzeuge fördert sie einen sachlichen Dialog zwischen Regierung, Fachleuten und Öffentlichkeit, um gemeinsam bessere politische Lösungen zu entwickeln.',
    },
  },
  {
    id: '2',
    question: {
      'zh-TW': '誰可以參與 vTaiwan？',
      en: 'Who can participate in vTaiwan?',
      ja: '誰がvTaiwanに参加できますか？',
      de: 'Wer kann an vTaiwan teilnehmen?',
    },
    answer: {
      'zh-TW': '任何對公共政策有興趣的公民都可以參與 vTaiwan 的討論。無論您是一般民眾、專家學者、企業代表或政府官員，都歡迎加入我們的平台，分享您的觀點和建議。',
      en: 'Any citizen interested in public policy can participate in the discussions on vTaiwan. Whether you are a general public, an expert, a business representative, or a government official, we welcome you to join our platform and share your views and suggestions.',
      ja: '公共政策に関心のあるすべての市民がvTaiwanの議論に参加できます。一般市民、専門家、企業代表、政府関係者など、どなたでもご参加いただき、ご意見やご提案をお寄せください。',
      de: 'Alle Bürgerinnen und Bürger, die sich für öffentliche Politik interessieren, können sich an den Diskussionen auf vTaiwan beteiligen. Ob Sie als Privatperson, als Fachkraft aus Wissenschaft und Praxis, als Unternehmensvertretung oder als Regierungsmitglied teilnehmen: Sie sind herzlich eingeladen, Ihre Ansichten und Vorschläge auf unserer Plattform einzubringen.',
    },
  },
  {
    id: '3',
    question: {
      'zh-TW': '如何在 vTaiwan 上提出議題？',
      en: 'How to propose a topic on vTaiwan?',
      ja: 'vTaiwanでどのように議題を提案できますか？',
      de: 'Wie kann ich auf vTaiwan ein Thema vorschlagen?',
    },
    answer: {
      'zh-TW':
        '您可以透過以下方式提出政策議題與社會議題：參與我們的 <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack 頻道</a> 討論，或參加 <a href="https://www.vtaiwan.tw/meetups" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">線上會議</a> 分享您的想法。請提供議題名稱、背景說明、預期目標等相關資訊。我們的團隊會進行初步審核，確認議題的適切性和完整性。',
      en: 'You can propose policy and social topics through the following ways: participate in our <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack channel</a> discussions, or join <a href="https://www.vtaiwan.tw/meetups" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">online meetings</a> to share your ideas. Please provide relevant information including topic name, background description, and expected goals. Our team will conduct a preliminary review to confirm the appropriateness and completeness of the topic.',
      ja: '以下の方法で政策議題と社会議題を提案できます：私たちの <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slackチャンネル</a> での議論に参加するか、<a href="https://www.vtaiwan.tw/meetups" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">オンライン会議</a> に参加してアイデアを共有してください。議題名、背景説明、目標などの関連情報を提供してください。当チームが内容の適切性と完全性を確認します。',
      de: 'Sie können politische und gesellschaftliche Themen vorschlagen, indem Sie sich an Diskussionen in unserem <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack-Kanal</a> beteiligen oder Ihre Ideen in unseren <a href="https://www.vtaiwan.tw/meetups" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Online-Treffen</a> vorstellen. Bitte geben Sie den Namen des Themas, Hintergrundinformationen, die angestrebten Ziele und weitere relevante Informationen an. Unser Team prüft zunächst, ob das Thema geeignet und ausreichend beschrieben ist.',
    },
  },
  {
    id: '4',
    question: {
      'zh-TW': 'vTaiwan 的討論流程是什麼？',
      en: 'What is the discussion process of vTaiwan?',
      ja: 'vTaiwanの議論プロセスはどのようなものですか？',
      de: 'Wie läuft eine Diskussion bei vTaiwan ab?',
    },
    answer: {
      'zh-TW': 'vTaiwan 的討論流程通常包括四個階段：',
      en: 'The discussion process of vTaiwan usually includes four stages:',
      ja: 'vTaiwanの議論プロセスは通常、次の4つの段階で構成されます：',
      de: 'Der Diskussionsprozess bei vTaiwan umfasst üblicherweise vier Phasen:',
    },

    details: {
      'zh-TW': ['議題收集：收集各方對特定政策議題的意見和建議', '意見徵集：透過線上平台廣泛徵集公眾意見', '審議討論：舉辦線上或實體會議，深入討論議題', '政策形成：整合各方意見，形成具體政策建議'],
      en: [
        'Topic Collection: Collecting opinions and suggestions from all parties on specific policy topics',
        'Public Opinion Collection: Broadly collecting public opinions through online platforms',
        'Discussion and Review: Holding online or offline meetings to discuss the topics in depth',
        'Policy Formulation: Integrating all opinions to form specific policy recommendations',
      ],
      ja: [
        '議題収集：特定の政策議題に関する意見や提案を集める',
        '意見募集：オンラインプラットフォームを通じて広く意見を募集する',
        '審議討論：オンラインまたは対面で会議を開催し、議題を深く議論する',
        '政策形成：さまざまな意見を統合し、具体的な政策提案をまとめる',
      ],
      de: [
        'Themensammlung: Meinungen und Vorschläge aller Beteiligten zu bestimmten politischen Themen sammeln',
        'Meinungssammlung: Über Online-Plattformen Meinungen aus der breiten Öffentlichkeit einholen',
        'Beratung und Diskussion: Online- oder Präsenztreffen für eine vertiefte Auseinandersetzung mit den Themen veranstalten',
        'Politikgestaltung: Unterschiedliche Sichtweisen zu konkreten politischen Empfehlungen zusammenführen',
      ],
    },
  },
  {
    id: '5',
    question: {
      'zh-TW': 'vTaiwan 的討論結果如何被採納？',
      en: 'How are the results of vTaiwan discussions implemented?',
      ja: 'vTaiwanの議論結果はどのように活用されますか？',
      de: 'Wie werden die Diskussionsergebnisse von vTaiwan aufgegriffen?',
    },
    answer: {
      'zh-TW':
        'vTaiwan 的討論結果會被整理成政策建議報告，提交給相關政府部門、企業或第三部門參考。過去已有多項透過 vTaiwan 討論形成的政策建議被政府採納，並轉化為實際的法規或政策。此外，第三部門組織也會使用這些意見徵集程序，並透過其他公共參與途徑如 <a href="https://join.gov.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Join 平台連署</a>、<a href="https://g0v.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">公民協作</a> 等方式達到解決方案。vTaiwan 扮演的是促進對話和形成共識的通道，而非最終的決策者。',
      en: 'The results of vTaiwan discussions are compiled into policy recommendation reports and submitted to relevant government departments, enterprises, or third-sector organizations for reference. Many policy recommendations discussed on vTaiwan have been adopted by the government and transformed into actual regulations or policies. Additionally, third-sector organizations also utilize these opinion collection processes and achieve solutions through other public participation channels such as <a href="https://join.gov.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Join platform petitions</a> and <a href="https://g0v.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">citizen collaboration</a>. vTaiwan serves as a channel for promoting dialogue and reaching consensus, rather than being the final decision-maker.',
      ja: 'vTaiwanの議論結果は政策提言レポートとしてまとめられ、関係省庁、企業、第三セクター組織に提出されます。過去にはvTaiwanで議論された提案が政府に採用され、実際の法令や政策となった例もあります。さらに、第三セクター組織もこれらの意見収集プロセスを活用し、<a href="https://join.gov.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Joinプラットフォームの署名</a>や<a href="https://g0v.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">市民協働</a>などの他の公共参加ルートを通じて解決策を実現しています。vTaiwanは対話と合意形成を促進するチャネルとして機能し、最終的な意思決定者ではありません。',
      de: 'Die Diskussionsergebnisse von vTaiwan werden zu Berichten mit politischen Empfehlungen zusammengefasst und den zuständigen Regierungsstellen, Unternehmen oder zivilgesellschaftlichen Organisationen als Entscheidungsgrundlage vorgelegt. Bereits mehrere Empfehlungen aus vTaiwan-Diskussionen wurden von der Regierung übernommen und in konkrete Vorschriften oder politische Maßnahmen umgesetzt. Auch zivilgesellschaftliche Organisationen nutzen diese Verfahren zur Meinungssammlung und entwickeln Lösungen über weitere Beteiligungswege wie <a href="https://join.gov.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Petitionen auf der Join-Plattform</a> und <a href="https://g0v.tw/" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">bürgerliche Zusammenarbeit</a>. vTaiwan schafft einen Rahmen für Dialog und Konsensbildung, trifft aber nicht die endgültigen Entscheidungen.',
    },
  },
  {
    id: '6',
    question: {
      'zh-TW': '如何追蹤議題的進展？',
      en: 'How to track the progress of topics?',
      ja: '議題の進捗はどのように追跡できますか？',
      de: 'Wie kann ich den Fortschritt der Themen verfolgen?',
    },
    answer: {
      'zh-TW':
        '您可以在 vTaiwan 網站上查看各議題的最新進展和討論結果。我們會定期更新議題狀態，包括討論階段、參與人數、關鍵意見等資訊。您也可以加入 <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack #vTaiwan 頻道</a> 和瀏覽 <a href="https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">vTaiwan 工作組會議記錄</a>，獲取最新的議題進展通知。',
      en: 'You can view the latest progress and discussion results of each topic on the vTaiwan website. We will regularly update the topic status, including the discussion phase, the number of participants, and key opinions. You can also join the <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack #vTaiwan channel</a> and browse the <a href="https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">vTaiwan working group meeting records</a> to receive the latest topic progress notifications.',
      ja: 'vTaiwanのウェブサイトで各議題の最新の進捗や議論結果を確認できます。議題のステータス（議論段階、参加人数、主要な意見など）は定期的に更新されます。また、<a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack #vTaiwanチャンネル</a> に参加したり、<a href="https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">vTaiwan作業グループ会議記録</a> を閲覧することで最新情報を受け取ることも可能です。',
      de: 'Auf der vTaiwan-Website finden Sie die neuesten Entwicklungen und Diskussionsergebnisse zu jedem Thema. Wir aktualisieren regelmäßig den Stand der Themen, darunter die Diskussionsphase, die Zahl der Teilnehmenden und wichtige Meinungen. Sie können außerdem dem <a href="https://g0v-tw.slack.com/archives/C2Q1M4N1J" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Slack-Kanal #vTaiwan</a> beitreten und die <a href="https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book" target="_blank" rel="noopener noreferrer" class="text-democratic-red hover:underline">Sitzungsprotokolle der vTaiwan-Arbeitsgruppe</a> lesen, um über aktuelle Fortschritte informiert zu bleiben.',
    },
  },
]
