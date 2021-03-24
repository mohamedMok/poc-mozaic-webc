import Button from './Button.svelte';

export default {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    label: { control: 'text' },
    size: {
      control: { type: 'select', options: ['s', 'm', 'l'] },
    },
    theme: {
      control: { type: 'select', options: ['solid', 'bordered', 'bordered-neutral', 'solid-neutral', 'solid-primary-02', 'bordered-primary-02', 'solid-danger', 'bordered-danger'] },
    },
    width: {
      control: { type: 'select', options: ['fit', 'full'] },
    },
    onClick: { action: 'onClick' },
  },
};

const Template = ({ onClick, ...args }) => ({
  Component: Button,
  props: args,
  on: {
    click: onClick,
  },
});

export const Primary = Template.bind({});
Primary.args = {
  label: 'Button',
};

export const Secondary = Template.bind({});
Secondary.args = {
  label: 'Button',
  theme: 'bordered'
};

export const Large = Template.bind({});
Large.args = {
  size: 'l',
  label: 'Button',
};

export const Small = Template.bind({});
Small.args = {
  size: 's',
  label: 'Button',
};

export const Full = Template.bind({});
Full.args = {
  label: 'Button',
  width: 'full'
};

export const WithIcon = Template.bind({});
WithIcon.args = {
  label: 'Button',
  icon: true,
  iconPosition: 'left',
};

export const OnlyIcon = Template.bind({});
OnlyIcon.args = {
  icon: true,
  iconPosition: 'left',
};
