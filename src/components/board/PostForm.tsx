import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
})

type PostFormValues = z.infer<typeof postSchema>

export function PostForm() {
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { title: '', content: '' },
  })

  const onSubmit = (values: PostFormValues) => {
    // TODO: apiClient로 실제 저장 연결. 지금은 데모 — 입력값 확인 후 성공 표시.
    console.log('new post', values)
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{t('write-title-label')}</Label>
        <Input id="title" {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{t('write-required')}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">{t('write-content-label')}</Label>
        <Textarea id="content" rows={6} {...register('content')} />
        {errors.content && <p className="text-sm text-destructive">{t('write-required')}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">{t('write-submit')}</Button>
        {submitted && <span className="text-sm text-muted-foreground">{t('write-success')}</span>}
      </div>
    </form>
  )
}
