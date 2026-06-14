import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import QuestionTypeBadge from '../src/components/QuestionTypeBadge.vue';

describe('QuestionTypeBadge', () => {
  it('renders Chinese labels for known types', () => {
    const wrapper = mount(QuestionTypeBadge, { props: { type: 'analogy' } });
    expect(wrapper.text()).toContain('类似结构');
  });
});

