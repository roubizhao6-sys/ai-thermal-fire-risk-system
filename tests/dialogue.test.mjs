// 起火阶段「二元问答」纯逻辑单测：问题顺序、跳过规则、指引生成、救援端快照。

import {
  QUESTIONS,
  answerQuestion,
  buildAdvice,
  createDialogueState,
  needsHelp,
  nextQuestion,
  progressOf,
  summarizeForRescue,
} from '../src/user/binaryDialogue.js'

let failures = 0
function check(name, condition, detail = '') {
  if (condition) console.log(`  PASS  ${name}`)
  else { failures += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('[1] 提问顺序与进度')
{
  let state = createDialogueState()
  check('第一个问题问是否看到火光', nextQuestion(state).id === 'seeFlame')
  state = answerQuestion(state, 'seeFlame', 'no')
  check('第二个问题问能不能走', nextQuestion(state).id === 'canWalk')
  check('进度 1/5', progressOf(state).answered === 1 && progressOf(state).total === QUESTIONS.length)
}

console.log('[2] 跳过与完成')
{
  let state = createDialogueState()
  state = answerQuestion(state, 'seeFlame', 'no')
  state = answerQuestion(state, 'canWalk', 'yes')
  const next = nextQuestion(state)
  check('能走时不问门烫不烫', next.id !== 'doorHot')
  state = answerQuestion(state, 'heavySmoke', 'no')
  state = answerQuestion(state, 'someoneStuck', 'no')
  check('答完自动结束', state.done === true && nextQuestion(state) === null)
  check('进度按跳过后的总数计算', progressOf(state).total === QUESTIONS.length - 1)
}

console.log('[3] 指引随答案变化')
{
  const walkable = answerQuestion(createDialogueState(), 'canWalk', 'yes')
  check('能走 → 按箭头前进', buildAdvice(walkable, { routeOk: true, exitLabel: '南门', meters: 42 }).text.includes('南门'))

  const stuck = answerQuestion(createDialogueState(), 'canWalk', 'no')
  const stuckAdvice = buildAdvice(stuck)
  check('走不动 → 原地避险', stuckAdvice.text.includes('不要勉强移动') && stuckAdvice.tone === 'danger')
  check('走不动 → 判定为需帮助', needsHelp(stuck) === true)

  const hotDoor = answerQuestion(createDialogueState(), 'doorHot', 'yes')
  check('门烫 → 不要开门', buildAdvice(hotDoor).text.includes('不要开门'))

  let flame = createDialogueState()
  flame = answerQuestion(flame, 'seeFlame', 'yes')
  flame = answerQuestion(flame, 'canWalk', 'yes')
  flame = answerQuestion(flame, 'heavySmoke', 'no')
  flame = answerQuestion(flame, 'someoneStuck', 'no')
  check('看到明火 → 背离火光撤离', buildAdvice(flame, { exitLabel: '东门', meters: 30 }).text.includes('背离火光'))

  const smoke = answerQuestion(answerQuestion(createDialogueState(), 'heavySmoke', 'yes'), 'canWalk', 'yes')
  check('烟雾明显 → 贴地移动', buildAdvice(smoke).text.includes('贴地'))

  const blocked = buildAdvice(createDialogueState(), { routeOk: false })
  check('通道受阻 → 原地等待', blocked.text.includes('通道受阻'))
}

console.log('[4] 救援端快照')
{
  let state = createDialogueState()
  state = answerQuestion(state, 'seeFlame', 'no')
  state = answerQuestion(state, 'canWalk', 'no')
  const snapshot = summarizeForRescue(state, { floor: 6, spot: 'C', routeOk: false })
  check('快照带楼层与位置', snapshot.floor === 6 && snapshot.spot === 'C')
  check('快照标记需帮助', snapshot.needsHelp === true)
  check('快照含答案摘要', snapshot.answers.some((line) => line.includes('能自己走到楼梯口')))
  check('快照有更新时间', typeof snapshot.updatedAt === 'number' && snapshot.updatedAt > 0)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
