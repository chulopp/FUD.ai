import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: '/',
      title: (
        <span className="flex items-center gap-2">
          <img
            src="/LOGOFUD.svg"
            alt="FUD.ai logo"
            className="h-7 w-7"
          />
          FUD.ai
        </span>
      ),
    },
    githubUrl: 'https://github.com/chulopp/FUD.ai',
  };
}
