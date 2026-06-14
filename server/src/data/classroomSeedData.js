export const classroomCorpus = [
  {
    sourceKey: 'class-give-give',
    groupName: 'give',
    english: 'give',
    chinese: '给',
    englishExplain: 'to provide something',
    phonetic: '/ɡɪv/',
    tags: ['verb', 'root']
  },
  {
    sourceKey: 'class-give-given',
    groupName: 'give',
    english: 'given',
    chinese: '给予（过去分词）',
    englishExplain: 'past participle of give',
    phonetic: '/ˈɡɪvən/',
    tags: ['verb', 'inflection']
  },
  {
    sourceKey: 'class-give-give-up',
    groupName: 'give',
    english: 'give up',
    chinese: '放弃',
    englishExplain: 'to quit or stop trying',
    phonetic: '/ɡɪv ʌp/',
    tags: ['phrase']
  },
  {
    sourceKey: 'class-give-give-out',
    groupName: 'give',
    english: 'give out',
    chinese: '分发/耗尽',
    englishExplain: 'to distribute or run out',
    phonetic: '/ɡɪv aʊt/',
    tags: ['phrase']
  },
  {
    sourceKey: 'class-give-give-away',
    groupName: 'give',
    english: 'give away',
    chinese: '赠送/泄露',
    englishExplain: 'to donate or reveal a secret',
    phonetic: '/ɡɪv əˈweɪ/',
    tags: ['phrase']
  }
];

export const classroomGraphFallback = {
  nodes: [
    { id: 'give', name: 'give', type: 'root', meaning: '给' },
    { id: 'given', name: 'given', type: 'inflection', meaning: '给予（过去分词）' },
    { id: 'give_up', name: 'give up', type: 'phrase', meaning: '放弃' },
    { id: 'give_out', name: 'give out', type: 'phrase', meaning: '分发/耗尽' },
    { id: 'give_away', name: 'give away', type: 'phrase', meaning: '赠送/泄露' }
  ],
  edges: [
    { source: 'give', target: 'given', label: '词形变化' },
    { source: 'give', target: 'give_up', label: '词组' },
    { source: 'give', target: 'give_out', label: '词组' },
    { source: 'give', target: 'give_away', label: '词组' },
    { source: 'give_up', target: 'give_out', label: '易混淆' }
  ]
};

