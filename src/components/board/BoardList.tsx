import { useTranslation } from 'react-i18next'

import { SAMPLE_POSTS } from './constants'

export function BoardList() {
  const { t } = useTranslation()
  const posts = SAMPLE_POSTS

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{t('board-list-title')}</h2>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">{t('board-empty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-medium">{post.title}</span>
              <span className="text-sm text-muted-foreground">
                {post.author} · {post.createdAt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
