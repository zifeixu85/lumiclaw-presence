import type {Preview} from '@storybook/nextjs-vite';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    a11y: {test: 'error'},
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: {pathname: '/mission'}
    }
  }
};

export default preview;
