# OC Board — 권한(Permission) 모델 가이드

> **기준**: 레거시 `jupiter-board-web`(Vue) 권한 체계 심층 분석. 리뉴얼(`oc-board-front`)이 따라야 할 **참조 모델**이며, 맨 아래 [10. 우리 구현 현황](#10-우리-구현-현황-oc-board-front)에 현재 상태를 정리한다.
> 본문의 `파일:라인` 참조는 **레거시(Vue) 기준** — 우리 React 코드 위치가 아니다.
> API 엔드포인트 상세는 [api-reference.md](./api-reference.md) 참조.

---

## 0. 권한 모델 — 세 종류의 "관리자"

| 플래그 | 의미 | 출처 | 어디에 쓰이나 |
|---|---|---|---|
| `me.is_admin` | 전체(회사/기능) 관리자 | `GET /me` | 전 영역 |
| `me.is_category_admin` | 카테고리 관리자 | `GET /me` | **관리 네비/설정 게시판 메뉴 노출용만** |
| `me.is_board_admin` | 게시판 관리자 | `GET /me` | **관리 네비/설정 게시판 메뉴 노출용만** |
| `category.is_admin` / `child.is_admin` | 이 카테고리/폴더 관리 권한 | 카테고리 트리 응답 | 설정에서 행별 수정/삭제 게이팅 |
| `board.is_admin` / `drive.is_admin` | 이 게시판/자료실 관리 권한 | 게시판·드라이브 응답 | 공지 설정, 드라이브 삭제 |
| `post.is_admin` | 이 글에 대한 관리 권한 | 게시글 응답 | 게시글/댓글 삭제 |
| `post.is_mine` / `comment.is_mine` | 본인 소유 | 응답 | 수정/삭제 |

**가장 중요한 개념 2가지**
1. **콘텐츠(게시글/댓글) 권한은 전역 `me.is_*`가 아니라 백엔드가 글 단위로 내려주는 `post.is_admin`을 쓴다.** `me.is_category_admin`·`me.is_board_admin`은 설정 메뉴 노출에만 쓰이고 게시글/댓글엔 안 쓰인다.
2. **관리 권한은 계단식**: 전체 > 카테고리 > 게시판. 상위는 하위를 포함.

---

## 1. ⚠️ 접근 제어 구조 (대전제)

**클라이언트 route guard가 전혀 없다.** 유일한 전역 가드는 로그인 토큰만 검사(`router/index.ts:11`). `beforeEnter`·route meta·role 체크 0건.

- 설정 페이지 접근 제어 = ① 네비 메뉴 `v-if` 숨김 + ② 페이지가 role별로 다른 API 호출, 이 두 가지뿐.
- 레이아웃 선택도 role 무관, **경로 기반** (`route.matched[0].path === '/setting'`, `App.vue:112`).
- 비관리자가 `/setting/public` URL을 직접 치면 → 페이지는 렌더됨 → 관리자 API 호출 → **서버 403** → 인터셉터(`api.ts:64-77`)가 권한 에러 모달 표시 → 뒤로가기.

즉 **실질 보안은 100% 서버**에 있고, 프론트는 "안 보이게" 할 뿐이다.

---

## 2. 데이터 로딩 — 3개 카테고리 함수가 "보이는 범위"를 결정

| 함수 | 엔드포인트 | 반환 범위 | publicBoards | 누가 씀 | 위치 |
|---|---|---|---|---|---|
| `selectCategories({with_category_admin:1})` | `GET /category` | 내가 볼 수 있는 것(멤버 범위) | ✅ | 일반 사용자 사이드바 | `category.ts:12` |
| `selectAdminCategories()` | `GET /category/admin` | 회사 전체 트리 | ✅ | 전체 관리자 | `category.ts:27` |
| `selectMasterCategories()` | `GET /category/management` | 내가 관리하는 것만 | ❌ | 설정>게시판(비 전체관리자) | `category.ts:35` |

→ "관리자가 더 많이 본다"는 프론트가 범위를 넓히는 게 아니라 **관리자 전용 엔드포인트를 호출**하기 때문이다.

---

## 3. 설정(⚙) 영역

진입은 **누구나** — 헤더 톱니가 role 게이팅 없음 (`DefaultHeader.vue:208/246`).

### 3-1. 좌측 메뉴 노출 (`AdminNavigation.vue`)
| 메뉴 | 조건 | 일반 | 게시판관리자 | 카테고리관리자 | 전체관리자 |
|---|---|:-:|:-:|:-:|:-:|
| 일반(환경설정) | 없음 | ✅ | ✅ | ✅ | ✅ |
| 메인화면 | `is_admin` (:48) | ❌ | ❌ | ❌ | ✅ |
| 게시판 관리 | `is_admin \|\| is_category_admin \|\| is_board_admin` (:61) | ❌ | ✅ | ✅ | ✅ |
| 공용 관리 | `is_admin` (:74) | ❌ | ❌ | ❌ | ✅ |
| 로그아웃 | 없음 | ✅ | ✅ | ✅ | ✅ |

→ 일반 사용자는 "환경설정 + 로그아웃"만 본다.

### 3-2. 환경설정 `/setting` — 전원 (`setting/index.vue`)
role 분기 없음. 개인 알림 설정 전용:
| 항목 | API 필드 |
|---|---|
| 댓글 알림 / 좋아요 알림 (전역) | `is_comment_alarm` / `is_like_alarm` |
| 공지 허용 / 알림 허용 (전역) | `is_notice_alarm` / `is_post_alarm` |
| 게시판별 공지/알림 체크박스 | `updateBoardMember(id,{is_post_alarm,is_notice_alarm})` |

체크박스 비활성은 role이 아니라 **전역 토글 OFF 또는 게시판 설정에 종속**. (자료실은 공지 열 숨김.)

### 3-3. 메인화면 `/setting/main` — 전체 관리자 전용 (`setting/main.vue`)
- 최신글 노출 기간 라디오(7/30/60/90일) → `latest_post_day` 저장.
- 페이지 내부 role 분기 없음(네비 숨김으로만 관리자화). 노출 게시판 수/타입 설정은 대량 주석 처리(비활성).

### 3-4. 게시판 관리 `/setting/board` — 관리자 3종 (`setting/board/index.vue`)
- 설명문부터 다름: 전체 관리자 "카테고리 및 게시판을 추가하고…" vs 그 외 "관리 중인 게시판의 설정을 변경…" (:137).
- 데이터: 전체 관리자→`selectAdminCategories`, 그 외→`selectMasterCategories` (:63).

**"추가" 드롭다운 (계단식)** (`setMenus:73`):
| 항목 | 조건 |
|---|---|
| 카테고리 추가 | `is_admin`만 |
| 폴더 추가 | + `is_category_admin` |
| 게시판/자료실 추가 | + `is_board_admin` |

**행별 버튼**:
| 대상 | 수정/삭제 노출 조건 | 미충족 |
|---|---|---|
| 카테고리 | `is_admin \|\| category.is_admin` (:206,:219) | "−" |
| 폴더 | `is_admin \|\| category.is_admin \|\| child.is_admin` (:305) | "−" |
| 게시판/자료실 | 조건 없음 — 행이 보이면 항상 노출 | — |
| 공지 편집 | `!board.is_drive`(드라이브는 "−") | — |
| 목록 편집 버튼 | `is_admin \|\| is_category_admin` (게시판 관리자 제외) (:143) | 숨김 |

→ 게시판 행의 수정/삭제는 role 조건이 없고, **트리 로딩 범위(admin 전체 vs 관리 대상만)가 사실상 통제**한다.

### 3-5. 공용 관리 `/setting/public` — 전체 관리자 전용 (`setting/public.vue`)
전사공개 게시판/자료실 추가·설정, 드래그 순서 변경 → `POST /management/board`.

### 3-6. 목록 편집 `/setting/board/order` — `is_admin || is_category_admin` (`order.vue`)
순서 이동은 개체 `is_admin`으로 정밀 게이팅 (:38-47):
- 최상위 카테고리 순서변경 = `is_admin`만
- 카테고리 하위 = `selectedCategory.is_admin`
- 폴더 하위 = `child.is_admin || category.is_admin`

→ 저장 시 diff(`update_*_position`, `delete_*_id`)를 `POST /management/category/edit`로 전송.

---

## 4. 생성/수정 모달 — 공개 범위 & 관리자 지정

### 4-1. 공통 인프라
- **공개 범위 UI** = 조직도 트리(`Department.vue`). 상위 부서 체크 시 하위 부서·구성원 전부 자동 선택(`organization.ts:144-173`). 저장 시 구성원 id→`insert_*_member_user_id`, 부서 id→`insert_*_department_id`.
- **관리자 지정** = `management.vue`. **공개 범위에 포함된 사람 중에서만** 관리자 지정 가능(:77). 미지정 저장 시 "…기능 관리자만 관리 가능합니다" 확인 모달.
- **위치 트리 게이팅**: 최상위 카테고리에 배치하려면 `category.is_admin || me.is_admin` (`AddBoardModal:342`, `AddDriveModal:446`); 폴더 위치 드롭다운은 `categories.filter(is_admin || me.is_admin)` (`AddFolderModal:251`).

### 4-2. 모달별 설정 항목
| 모달 | 설정 가능 필드 | 공개 게시판(`is_public`)일 때 |
|---|---|---|
| 게시판 (`AddBoardModal`) | 위치·게시판명·설명·공개 범위·관리자·타입(기본/미리보기/앨범)·게시판알림·공지알림 | 위치="공용" 고정, 공개 범위·관리자 숨김 |
| 카테고리 (`AddCategoryModal`) | 카테고리명·공개 범위·관리자 | (공개 변형 없음) |
| 폴더 (`AddFolderModal`) | 위치(상위 카테고리)·폴더명·공개 범위·관리자 | 공개 범위는 상위 카테고리 범위 내에서만 |
| 자료실 (`AddDriveModal`) | 위치·자료실명·공개 범위·관리자·파일별 용량·전체 용량·업로드 불가 확장자·알림 | 위치 고정, 공개 범위·관리자 숨김 |
| 공지 설정 (`NoticePostsModal`) | 게시판별 공지 등록/해제, 기간(항상 고정/기간 설정) | 일반 게시판 전용(`!is_drive`) |

- **수정 모드 공통**: 위치 잠금, 기존값 프리필, 저장은 현재 vs 기존 diff(insert/delete 세트).
- 타입 라디오(기본형/미리보기형/액자형)는 **게시판 모달에만**, 용량/확장자는 **자료실 모달에만**.

---

## 5. 게시글 / 댓글 — "수정=본인만, 삭제=본인 또는 관리자"

이 규칙이 게시글·댓글·답글 **전부에 일관** 적용된다. 여기서 "관리자"는 `post.is_admin`(글 단위).

| 대상 | 수정 | 삭제 |
|---|---|---|
| 게시글 (PC `PostView:381-389`) | `is_mine` | `is_mine \|\| post.is_admin` |
| 게시글 (수정화면 진입 `AddPostView:539`) | `is_mine` 아니면 "권한 없음" 튕김 | — |
| 댓글 (`Comment:190-196`) | `is_mine` | `is_mine \|\| post.is_admin` |
| 답글 (`ReplyComment:140-146`) | `is_mine` | `is_mine \|\| post.is_admin` |

**공지로 등록** (작성/수정 시) — `isPossibleNotice` (`AddPostView:83`):
| 사용자 | 공개 게시판 | 비공개 게시판 |
|---|:-:|:-:|
| 전체 관리자 | ✅ | ✅ |
| 그 게시판/카테고리 관리자 | ❌ | ✅ |
| 일반 | ❌ | ❌ |

**기타**: 댓글에 신고 기능 없음. 댓글 섹션 자체는 글쓴이의 `is_allow_comment`로 열림(권한 무관). 케밥 노출은 게시글 헤더=항상(항목만 축소) vs 댓글=권한 없으면 숨김.

---

## 6. 드라이브(자료실)

프론트에서 role로 **실제 막는 건 "남의 파일 삭제" 하나뿐**. 나머지(폴더 생성·업로드·이름변경·다운로드·미리보기)는 프론트 무게이팅 → 서버 위임.

| 액션 | 일반 | 자료실 관리자(`drive.is_admin`) | 전체 관리자 |
|---|:-:|:-:|:-:|
| 열람·미리보기·다운로드·즐겨찾기 | ✅ | ✅ | ✅ |
| 새폴더·업로드·폴더 이름변경 | ✅(프론트 무게이팅) | ✅ | ✅ |
| 내 파일 삭제 | ✅ | ✅ | ✅ |
| 남의 파일 삭제 | ❌ 차단(`index.vue:178-181`) | ✅ | ✅ |
| 폴더 삭제 | 프론트 미차단(서버 위임) | ✅ | ✅ |
| 자료실 추가/설정 | ❌ | 설정 진입 권한 필요 | ✅ |

- 삭제 판정: `drive.is_admin || me.id === file.user_id` (`index.vue:160-193`).
- **"이동(move)" 기능은 아예 없음**(스토어·UI 모두).

---

## 7. 사이드바 · 검색 · 로그인
- **사이드바** (`DefaultNavigation:118`): 전체 관리자→전체 트리, 일반→멤버 범위.
- **검색** (`search.vue:293`): 검색 쿼리엔 role 없음(서버가 신원 기준으로 좁힘). 모바일 게시판 필터용 카테고리만 role 분기.
- **로그인 직후 라우팅**: role 무관 모두 `/home`. 단 전체 관리자 + 회사설정 미완료면 온보딩 모달(`App.vue:74`) + 회사설정 자동 생성(`user.ts:33`).

---

## 8. 📋 종합 매트릭스
| 기능 | 일반 | 게시판관리자 | 카테고리관리자 | 전체관리자 |
|---|:-:|:-:|:-:|:-:|
| 환경설정(개인 알림) | ✅ | ✅ | ✅ | ✅ |
| 설정>게시판 진입 | ❌ | ✅(관리분만) | ✅(관리분만) | ✅(전체) |
| 설정>메인화면/공용관리 | ❌ | ❌ | ❌ | ✅ |
| 카테고리 추가 | ❌ | ❌ | ❌ | ✅ |
| 폴더 추가 | ❌ | ❌ | ✅ | ✅ |
| 게시판/자료실 추가 | ❌ | ✅ | ✅ | ✅ |
| 순서 편집 | ❌ | ❌ | ✅(관리분) | ✅ |
| 글 "공지로 등록" | ❌ | 관리 비공개판만 | 관리 비공개판만 | ✅(공개 포함) |
| 남의 글/댓글 삭제 | ❌ | 관리 범위 | 관리 범위 | ✅ |
| 남의 글/댓글 수정 | ❌ | ❌ | ❌ | ❌ |
| 남의 드라이브 파일 삭제 | ❌ | 그 자료실만 | 그 자료실만 | ✅ |

---

## 9. ⚠️ 레거시에서 발견된 불일치/버그 (포팅 시 주의·개선 포인트)
1. **route guard 부재** — 모든 설정 URL 직접 접근 가능(서버 403 의존). 서버가 안 막으면 그대로 노출.
2. **폴더 삭제 프론트 미검증** — `index.vue:171`에서 권한을 계산하지만 검사 없이 `:186`에서 무조건 삭제 호출(죽은 코드). 파일 삭제만 클라 차단.
3. **공지 수정 게이트 이원화** — UI 노출은 `isPossibleNotice`(me.is_admin/board admin)인데 수정 전송은 `post.is_admin`(`AddPostView:218`). 두 플래그 불일치 시 체크해도 공지 반영 안 될 수 있음.
4. **삭제 안내 문구 불일치** — PC는 실소유자 판정으로 "복구 불가" 경고, 모바일 헤더는 항상 "휴지통 이동" 고정 → 관리자 삭제 시 안내가 경로별로 다름.
5. **답글 삭제 모달 i18n 누락** — `ReplyComment.vue:281` 제목 하드코딩("삭제하시겠습니까?").
6. **디버그 로그 잔존** — `DefaultNavigation.vue:47` `console.log('관리자 : ...')`.

> 리뉴얼 시: route guard를 넣을지(레거시는 없음)와 3·2번 게이트 일원화는 **의식적으로 결정**해야 한다.

---

## 10. 우리 구현 현황 (oc-board-front)

레거시와 **동일 방침 채택**: route guard 없이 **플래그(`me.is_*`) + 서버 403** 조합. (사용자 확인: "라우트 가드는 없어, `is_admin` 트리거로 동작")

**완료**
- `GET /me` → `Me`(역할 플래그 포함) · `useMe()` · `isAnyAdmin(me)` = `is_admin || is_category_admin || is_board_admin` (`src/types/user.ts`)
- 사이드바 "관리자 설정" 메뉴 — `isAnyAdmin`일 때만 노출 (`src/components/common/AppShell.tsx`)
- `/admin` 화면 — `AdminGate`가 `is_admin` 플래그로 제어(비관리자 "권한 없음" 화면, 라우트 가드 아님) (`src/components/admin/AdminGate.tsx`)
- 프로필(이름·이메일·이니셜) = `/me` 실데이터

**미구현 (레거시 대비 남은 것)**
- 3개 카테고리 엔드포인트(`/category`, `/category/admin`, `/category/management`) 분기 — 사이드바/설정 트리 범위
- 설정 하위 페이지(환경설정·메인화면·게시판관리·공용관리·목록편집) 및 role별 메뉴/데이터 분기
- 생성/수정 모달(게시판·카테고리·폴더·자료실·공지)의 공개범위·관리자 지정·위치 게이팅
- 게시글/댓글 **수정=`is_mine`, 삭제=`is_mine || post.is_admin`** 및 "공지로 등록" 권한
- 드라이브 "남의 파일 삭제" 차단(`drive.is_admin || 본인`)
- (콘텐츠 권한은 전역 플래그가 아니라 **응답의 `post.is_admin`/`is_mine`** 사용해야 함 — 주의)

---

## 변경 이력
- 최초 작성: 레거시 `jupiter-board-web` 권한 체계 5영역 병렬 분석 통합 + 우리 구현 현황.
