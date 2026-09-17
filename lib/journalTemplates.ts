/**
 * Shapes to start a page from.
 *
 * A blank page is why journals stop getting written. These are prompts, not
 * forms — every one of them is editable to nothing, and the point is only to
 * get past the first sentence.
 */
export interface Template {
  key: string;
  label: string;
  hint: string;
  title: (day: string) => string;
  body: string;
}

const heading = (text: string) => `<h3>${text}</h3><p><br></p>`;

export const TEMPLATES: Template[] = [
  {
    key: 'blank',
    label: 'Blank page',
    hint: 'Nothing on it. Sometimes that is the right shape.',
    title: () => '',
    body: '',
  },
  {
    key: 'session',
    label: 'Session recap',
    hint: 'What the market did, what you did, and whether those were the same thing.',
    title: (day) => `Session — ${day}`,
    body: heading('What the market did')
      + heading('What I did')
      + heading('What I would repeat'),
  },
  {
    key: 'week',
    label: 'Week in review',
    hint: 'The one you write on a Sunday and read on a Wednesday.',
    title: (day) => `Week ending ${day}`,
    body: heading('The number')
      + heading('What actually drove it')
      + heading('One thing to change')
      + heading('One thing to leave alone'),
  },
  {
    key: 'debrief',
    label: 'Post-loss debrief',
    hint: 'Written after the loss, before the next trade.',
    title: (day) => `Debrief — ${day}`,
    body: heading('What happened, plainly')
      + heading('Where the decision actually went wrong')
      + heading('What I felt at the time')
      + heading('What would have stopped me'),
  },
  {
    key: 'idea',
    label: 'New idea',
    hint: 'Before it becomes a rule, and before you risk anything on it.',
    title: () => 'Idea — ',
    body: heading('The observation')
      + heading('Why it might work')
      + heading('How I would know it does not')
      + heading('What I need to see before risking anything'),
  },
];
