# 10. 업로드·부서·이미지·클라이언트 버전

## 공통 사항

응답 DTO·에러 봉투에는 [Huma 자동 특수필드](README.md#schema-field)를 함께 적용한다. 등록된 최상위 struct 응답에만 `$schema:string`(null 불가, 계산된 URL)와 `Link`가 추가되며 배열·map·빈Body·gin 직접응답에는 없다. 아래 업무 필드 표에 반복하지 않는다. 입력의 추가 키 불허도 framework의 readonly `$schema` 특수키는 예외다. [Huma transforms.go:157](https://github.com/danielgtaylor/huma/blob/v2.39.0/transforms.go#L157)

이 파일의 공통 오류표에406이 열거되어도 현재 router의 기본 format fallback에서는 미지원 Accept가 JSON으로 처리되어 일반적인406 분기가 생기지 않는다. Content-Type 누락·빈값은 JSON 기본이다. [Huma api.go:355](https://github.com/danielgtaylor/huma/blob/v2.39.0/api.go#L355), [defaults.go:79](https://github.com/danielgtaylor/huma/blob/v2.39.0/defaults.go#L79)

등록 엔드포인트 **6개**다. 업로드2개는 board bearer, 부서/사용자버전은 OfficeWave member bearer, 이미지/게스트버전은 exempt다. 서로 다른 토큰을 바꿔 쓰지 않는다. [`internal/transport/httpapi/router.go:365`](../../internal/transport/httpapi/router.go#L365) [`internal/transport/httpapi/router.go:440`](../../internal/transport/httpapi/router.go#L440)

curl 환경변수는 [README 실행 준비](README.md#curl-setup). 스코프는 `SCOPE="$BASE_URL/api/v1/board/companies/$COMPANY_ID/users/$USER_ID"`. scoped company_id/user_id는 토큰 숫자의 정규10진 문자열과 완전히 일치해야 하며 `001`, `+1` 같은 표현도403이다. [`internal/transport/httpapi/middleware/auth.go:212`](../../internal/transport/httpapi/middleware/auth.go#L212)

| status | code | 적용 |
| --- | --- | --- |
| 400 | INVALID_PAYLOAD | 업로드·부서·이미지 입력 오류 |
| 401 | UNAUTHORIZED | board/member bearer 오류 |
| 403 | FORBIDDEN | 스코프 또는 자료실 권한 거절 |
| 404 | NOT_FOUND | 자료실 대상·이미지 없음, 타회사 category |
| 409 | UPLOAD_NOT_PENDING | 완료처리 중 동시 변경으로 CAS실패 |
| 422 | BOARD_NOT_DRIVE / FOLDER_PARENT_INVALID | presign의 도메인 조건 |
| 422 | VALIDATION_ERROR | **클라이언트 버전**의 Huma 입력검증 |
| 413 | REQUEST_ENTITY_TOO_LARGE | JSON 전체1MiB 또는 이미지 리사이즈 byte/pixel제한 |
| 500 | INTERNAL_ERROR | DB·객체저장소 오류 |
| 503 | SERVICE_UNAVAILABLE | 미설정·취소·기한초과 |

공통 Huma406/408/415도 [README](README.md#huma-common)에 적용조건을 적었다. 오류코드 근거: [`internal/transport/httpapi/humaerr/humaerr.go:188`](../../internal/transport/httpapi/humaerr/humaerr.go#L188) [`internal/transport/httpapi/board/driveupload.go:126`](../../internal/transport/httpapi/board/driveupload.go#L126) [`internal/transport/httpapi/board/drivecomplete.go:206`](../../internal/transport/httpapi/board/drivecomplete.go#L206)

## 공유 DTO 필드 표

<a id="uploadresult"></a>
### 업로드 예약 응답

봉투는 **배열** `[{"result":{…}}, …]`이며 입력순서를 유지한다. 각 result는 아래 두 가지 중 하나다. null 대신 해당하지 않는 키를 생략한다. [`internal/transport/httpapi/board/driveuploadbody.go:116`](../../internal/transport/httpapi/board/driveuploadbody.go#L116) [`internal/transport/httpapi/board/driveuploadbody.go:172`](../../internal/transport/httpapi/board/driveuploadbody.go#L172)

| 필드 | 타입 | null | 저장/계산 | 포함 조건·포맷 |
| --- | --- | --- | --- | --- |
| result | object | 불가 | 계산 | 항목마다1개, 관계없음 |
| result.state | string | 불가 | 계산 | `success` 또는 `fail`; DB state인 UPLOADING/ACT/FAIL과 다름 |
| result.file_id | string(UUID) | 불가, 생략가능 | 생성후저장 | success만 |
| result.url | string(URL) | 불가, 생략가능 | 계산 | success만; presigned PUT URL |
| result.message | string | 불가, 생략가능 | 계산 | fail만; `not_allow_extension`, `exceeded_size_per_file`, `not_enough_drive_capacity` |

[`internal/transport/httpapi/board/driveuploadbody.go:155`](../../internal/transport/httpapi/board/driveuploadbody.go#L155) [`internal/domain/board/driveupload.go:129`](../../internal/domain/board/driveupload.go#L129)

완료 응답은 [DriveFileDTO](09-drive-file.md#drivefiledto) 객체 자체다. `src`/`object_key`/다운로드URL은 제공하지 않는다. [`internal/transport/httpapi/board/drivecomplete.go:184`](../../internal/transport/httpapi/board/drivecomplete.go#L184)

<a id="organizationdto"></a>
### 조직도 DTO

응답은 루트 객체 하나이며 루트가 없으면 **200 빈 Body**다. 배열 봉투가 아니다. `member_count`는 자신+모든자손의 user_id 중복을 제거한 수이며 `total_members`는 같은 집합이다. `members`는 직속소속행이라 겸직 중복이 있을 수 있다. [`internal/transport/httpapi/management/department.go:126`](../../internal/transport/httpapi/management/department.go#L126) [`internal/domain/board/departmenttree.go:244`](../../internal/domain/board/departmenttree.go#L244) [`internal/transport/httpapi/management/handler_test.go:264`](../../internal/transport/httpapi/management/handler_test.go#L264)

#### departmentBody

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:23`](../../internal/transport/httpapi/management/department.go#L23) |
| `parent_id` | int64(number) | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:24`](../../internal/transport/httpapi/management/department.go#L24) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:25`](../../internal/transport/httpapi/management/department.go#L25) |
| `breadcrumbs` | string | 불가 | 계산 | "{1,2,3}" 형태, JSON 배열아님 | [`internal/transport/httpapi/management/department.go:26`](../../internal/transport/httpapi/management/department.go#L26) |
| `member_count` | integer | 불가 | 계산 | 없음 | [`internal/transport/httpapi/management/department.go:27`](../../internal/transport/httpapi/management/department.go#L27) |
| `is_category_department` | boolean | 불가 | 계산 | category미지정 true; 지정시 카테고리부서+자손 집합에 포함되는지 | [`internal/transport/httpapi/management/department.go:28`](../../internal/transport/httpapi/management/department.go#L28) |
| `members` | []departmentMemberBody (array) | 불가 | 조회관계 | 기본 포함; 배열은[] | [`internal/transport/httpapi/management/department.go:29`](../../internal/transport/httpapi/management/department.go#L29) |
| `total_members` | []departmentMemberBody (array) | 불가 | 조회관계 | 기본 포함; 배열은[] | [`internal/transport/httpapi/management/department.go:35`](../../internal/transport/httpapi/management/department.go#L35) |
| `departments` | []departmentBody (array) | 불가 | 조회관계 | 기본 포함; 배열은[] | [`internal/transport/httpapi/management/department.go:36`](../../internal/transport/httpapi/management/department.go#L36) |

#### departmentMemberBody

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:43`](../../internal/transport/httpapi/management/department.go#L43) |
| `company_id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:44`](../../internal/transport/httpapi/management/department.go#L44) |
| `department_id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:45`](../../internal/transport/httpapi/management/department.go#L45) |
| `user_id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:46`](../../internal/transport/httpapi/management/department.go#L46) |
| `rank_id` | int64(number) | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:47`](../../internal/transport/httpapi/management/department.go#L47) |
| `role_id` | int64(number) | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:48`](../../internal/transport/httpapi/management/department.go#L48) |
| `position` | integer | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:49`](../../internal/transport/httpapi/management/department.go#L49) |
| `leader` | boolean | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:50`](../../internal/transport/httpapi/management/department.go#L50) |
| `user` | organizationUser (object) | 불가 | 조회관계 | 기본 포함 | [`internal/transport/httpapi/management/department.go:51`](../../internal/transport/httpapi/management/department.go#L51) |
| `rank` | rankBody (object) | 가능 | 조회관계 | 기본 포함 | [`internal/transport/httpapi/management/department.go:52`](../../internal/transport/httpapi/management/department.go#L52) |
| `role` | roleBody (object) | 가능 | 조회관계 | 기본 포함 | [`internal/transport/httpapi/management/department.go:53`](../../internal/transport/httpapi/management/department.go#L53) |
| `department` | memberDepartmentBody (object) | 가능 | 조회관계 | 기본 포함 | [`internal/transport/httpapi/management/department.go:54`](../../internal/transport/httpapi/management/department.go#L54) |

#### organizationUser

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:73`](../../internal/transport/httpapi/management/department.go#L73) |
| `name` | string | 가능 | 계산 | 없음 | [`internal/transport/httpapi/management/department.go:74`](../../internal/transport/httpapi/management/department.go#L74) |
| `profile_image_id` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:75`](../../internal/transport/httpapi/management/department.go#L75) |
| `disabled_at` | string | 가능 | 저장 | Go time.Time JSON(RFC3339, 소수/offset가변); /me PG9문자열과 다름 | [`internal/transport/httpapi/management/department.go:76`](../../internal/transport/httpapi/management/department.go#L76) |
| `deleted_at` | string | 가능 | 저장 | Go time.Time JSON(RFC3339, 소수/offset가변); /me PG9문자열과 다름 | [`internal/transport/httpapi/management/department.go:77`](../../internal/transport/httpapi/management/department.go#L77) |
| `profile_src` | string | 가능 | 계산 | 설정에 따른 URL; 중지/이미지없음 null | [`internal/transport/httpapi/management/department.go:78`](../../internal/transport/httpapi/management/department.go#L78) |

#### rankBody

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:82`](../../internal/transport/httpapi/management/department.go#L82) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:83`](../../internal/transport/httpapi/management/department.go#L83) |

#### roleBody

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:87`](../../internal/transport/httpapi/management/department.go#L87) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:88`](../../internal/transport/httpapi/management/department.go#L88) |

#### memberDepartmentBody

| 필드 | JSON 타입 | null | 저장/계산 | 관계·포맷 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `id` | int64(number) | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:92`](../../internal/transport/httpapi/management/department.go#L92) |
| `parent_id` | int64(number) | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:93`](../../internal/transport/httpapi/management/department.go#L93) |
| `name` | string | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:94`](../../internal/transport/httpapi/management/department.go#L94) |
| `path` | string | 가능 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:95`](../../internal/transport/httpapi/management/department.go#L95) |
| `position` | integer | 불가 | 저장 | 없음 | [`internal/transport/httpapi/management/department.go:96`](../../internal/transport/httpapi/management/department.go#L96) |

부서의 public.path와 breadcrumbs는 다르다. breadcrumbs는 현재 트리의 id로 재계산한다. 루트가 여러개이면 가장 작은id **하나만** 응답하며 부모없는 orphan은 노출하지 않는다. 부서는 parent_id NULL우선/id/position순, 소속행은 department_id/position/id순이다. [`internal/domain/board/departmenttree.go:99`](../../internal/domain/board/departmenttree.go#L99) [`internal/domain/board/departmenttree.go:140`](../../internal/domain/board/departmenttree.go#L140) [`internal/domain/board/departmenttree.go:195`](../../internal/domain/board/departmenttree.go#L195)

<a id="versiondto"></a>
### 클라이언트 버전 DTO

| 필드 | 타입 | null | 저장/계산 | 관계·포맷 |
| --- | --- | --- | --- | --- |
| `<platform>` | object | 불가 | 계산 | 플랫폼이 JSON객체의 키; 관계없음 |
| `<platform>.latest` | string | 가능 | 저장후선택 또는 기본값 | 버전문자열 그대로 |
| `<platform>.min` | string | 가능 | 저장후선택 또는 기본값 | 버전문자열 그대로 |

표준키는 `aos`, `ios`, `windows`, `macos`, `browser`, `cp_windows`, `cp_macos`, `windows_remote`, `macos_remote` 전부 포함한다. 후보가 없으면 latest/min 모두 `0.1.0`; 선택된 DB행이 null이면 null을 유지한다. 추가 플랫폼키도 가능하다. URL/comment/id는 응답없음. [`internal/domain/core/clientversion/entity.go:33`](../../internal/domain/core/clientversion/entity.go#L33) [`internal/domain/core/clientversion/resolve.go:23`](../../internal/domain/core/clientversion/resolve.go#L23) [`internal/transport/httpapi/core/clientversion.go:56`](../../internal/transport/httpapi/core/clientversion.go#L56)

후보는 전역행 OR company_id일치 OR user_id일치(삭제행제외), 표준플랫폼은 사용자우선→회사→전역. 버전은 점분리 정수비교이고 없거나 파싱불가 세그먼트=0이다. 비표준플랫폼은 정렬후 같은키를 계속 덮으므로 마지막후보가 남는다. 입력 회사/사용자의 실존·서로소속 검증은 게스트경로에 없다. [`internal/domain/core/clientversion/repository.go:26`](../../internal/domain/core/clientversion/repository.go#L26) [`internal/domain/core/clientversion/resolve.go:23`](../../internal/domain/core/clientversion/resolve.go#L23) [`internal/domain/core/clientversion/version.go:12`](../../internal/domain/core/clientversion/version.go#L12)

## ⚠️ 이 도메인의 함정

- presign 200은 업로드성공이 아니다. 파일별 result.state 확인→S3 PUT→완료API→ACT확인 순서다. 완료200도 객체없음·0byte·이미완료·FAIL일 수 있다. [`internal/transport/httpapi/board/driveupload.go:94`](../../internal/transport/httpapi/board/driveupload.go#L94) [`internal/transport/httpapi/board/drivecomplete.go:127`](../../internal/transport/httpapi/board/drivecomplete.go#L127)
- presign의 size=0은 스키마를 통과한다. 음수도 스키마에는 minimum이 없지만 승인된 음수파일 INSERT는 DB size>=0 CHECK로500이며 같은요청의 예약트랜잭션 전체가 롤백된다. [`internal/transport/httpapi/board/driveuploadbody.go:84`](../../internal/transport/httpapi/board/driveuploadbody.go#L84) [`internal/domain/board/driveupload.go:197`](../../internal/domain/board/driveupload.go#L197) [`migrations/board/000001_initial_schema.sql:823`](../../migrations/board/000001_initial_schema.sql#L823)
- presign 부모폴더는 같은board/company만 확인하며 **deleted_at 필터가 없다**. 삭제된 폴더도 존재하면 받아들인다. 정상사용자는 살아있는 폴더를 선택한다. [`internal/domain/board/driveuploadquery.go:117`](../../internal/domain/board/driveuploadquery.go#L117)
- `size_limit_per_file=null`은 업로드에서3GiB(3221225472바이트)다. 전체용량은 ACT와UPLOADING 예약을 포함하며, 같은요청 앞파일이 성공하면 뒷파일 가용량이 줄어든다. 완료시 전체할당량을 다시 검사하지 않으므로 실제크기가 신고크기보다 크면 용량초과 가능하다. [`internal/domain/board/driveupload.go:95`](../../internal/domain/board/driveupload.go#L95) [`internal/domain/board/driveupload.go:320`](../../internal/domain/board/driveupload.go#L320) [`internal/domain/board/drivecomplete.go:102`](../../internal/domain/board/drivecomplete.go#L102)
- presign은 예약커밋 뒤 URL을 서명한다. 중간서명실패는500이지만 예약행은 남는다. 생성후1시간만료를 매분배치가 FAIL로 정리한다. 완료/배치 경합은409가 될 수 있다. [`internal/transport/httpapi/board/driveupload.go:94`](../../internal/transport/httpapi/board/driveupload.go#L94) [`internal/domain/board/driveupload.go:85`](../../internal/domain/board/driveupload.go#L85) [`internal/transport/scheduler/scheduler.go:38`](../../internal/transport/scheduler/scheduler.go#L38) [`internal/transport/httpapi/board/drivecomplete.go:214`](../../internal/transport/httpapi/board/drivecomplete.go#L214)
- 이미지엔 board 권한판정이 없다. 접근가능 key prefix가 보안경계이며 원본o는 이미지검증과20MiB/40M픽셀제한을 우회해 객체바이트를 그대로 스트리밍한다. [`internal/transport/httpapi/image/image.go:177`](../../internal/transport/httpapi/image/image.go#L177) [`internal/platform/objectstore/objectstore.go:251`](../../internal/platform/objectstore/objectstore.go#L251)


### 이미지 URL의 출처

게시글 thumbnail의 src(7키)·조건부 생략은 [PostAttachmentView](05-post-read.md#postattachmentview), 프로필 profile_src는 [사용자 DTO](01-auth-user.md#mebody)의 조립 규칙을 따른다. 자료실 파일에는 src/썸네일 URL이 없고 [자료실 다운로드 URL](09-drive-file.md)의 발급 경로를 사용한다. `internal/transport/httpapi/board/postsbody.go:519`, `internal/transport/httpapi/board/postsbody.go:572`, `internal/transport/httpapi/board/postsbody.go:596`, `internal/transport/httpapi/board/drivefilesbody.go:456`

## POST /api/v1/board/companies/{company_id}/users/{user_id}/boards/{id}/drive-uploads

### 1. 경로

OperationID: `board-create-drive-uploads`. [`internal/transport/httpapi/board/routes.go:1118`](../../internal/transport/httpapi/board/routes.go#L1118)

다건 업로드 예약/PUT URL발급. [`internal/transport/httpapi/board/routes.go:1091`](../../internal/transport/httpapi/board/routes.go#L1091)

### 2. Path

company_id/user_id: int64의 정규10진 문자열, 토큰불일치403 FORBIDDEN. id: UUID문자열; Huma형식오류400 INVALID_PAYLOAD. [`internal/transport/httpapi/middleware/auth.go:261`](../../internal/transport/httpapi/middleware/auth.go#L261) [`internal/transport/httpapi/board/driveuploadbody.go:21`](../../internal/transport/httpapi/board/driveuploadbody.go#L21)

### 3. Query

없음. [`internal/transport/httpapi/board/driveuploadbody.go:21`](../../internal/transport/httpapi/board/driveuploadbody.go#L21)

### 4. Body

| 필드 | 타입 | 필수 | 기본값 | 검증·상한 |
| --- | --- | --- | --- | --- |
| files | object[] | 예 | 없음 | 0~10개; null도 빈 목록으로 통과(필드 생략은400) |
| files[].file_name | string | 예 | 없음 | minLength1, 길이상한없음; 공백만 있어도통과 |
| files[].extension | string | 예 | 없음 | 영문대소문자/숫자1~16자, 점불가 |
| files[].size | int64(number) | 예 | 없음 | 스키마상 최소/최대 없음(int64표현범위); DB는0이상, 게시판별제한 별도 |
| drive_folder_id | UUID string 또는 null | 아니오 | null(루트) | 같은board/company; 추가속성불허 |

객체 및 files각항목의 추가키 불허. 전체body1MiB. [`internal/transport/httpapi/board/driveuploadbody.go:44`](../../internal/transport/httpapi/board/driveuploadbody.go#L44) [`internal/transport/httpapi/board/driveuploadbody.go:84`](../../internal/transport/httpapi/board/driveuploadbody.go#L84)

### 5. 인증·권한

board bearer→PathScope→Body검증400→S3설정503→board없음/타회사/삭제404→Write권한403→type!=DRIVE422 BOARD_NOT_DRIVE→폴더불일치422 FOLDER_PARENT_INVALID→파일별판정. 권한없는 사람은 board타입과폴더판정까지 진행하지 못한다. [`internal/transport/httpapi/board/driveupload.go:78`](../../internal/transport/httpapi/board/driveupload.go#L78) [`internal/domain/board/driveupload.go:192`](../../internal/domain/board/driveupload.go#L192)

### 6. Response

| HTTP | 형태/code |
| --- | --- |
| 200 | [예약배열](#uploadresult), `files:[]`면 `[]`; 전건fail도200 |
| 400 | INVALID_PAYLOAD |
| 401/403/404 | UNAUTHORIZED/FORBIDDEN/NOT_FOUND |
| 422 | BOARD_NOT_DRIVE / FOLDER_PARENT_INVALID |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/board/driveupload.go:94`](../../internal/transport/httpapi/board/driveupload.go#L94) [`internal/transport/httpapi/board/driveupload.go:126`](../../internal/transport/httpapi/board/driveupload.go#L126)

### 7. 주의사항

응답은 file_name/extension/size를 echo하지 않으므로 로컬 File과 응답 배열을 index로 짝짓는다. 서버 객체 key는 `{AWS_DRIVE_FOLDER}/{file UUID}.{소문자 extension}`이고 DB extension은 요청 대소문자를 보존한다. object_key는 응답하지 않는다. `internal/transport/httpapi/board/driveuploadbody.go:116`, `internal/transport/httpapi/board/driveuploadbody.go:172`, `internal/domain/board/driveupload.go:350`, `internal/domain/board/driveupload.go:359`

파일별판정순서: 금지확장자(대소문자무시)→파일당크기→전체용량. 동등한크기는허용(>만거절). URL+예약은1시간. 본문파일순서가용량배분순서다. [`internal/domain/board/driveupload.go:320`](../../internal/domain/board/driveupload.go#L320)

### 8. 시나리오

```bash
# 정상조건(쓰기 가능한 DRIVE, 허용확장자, 충분한용량) →200 result.state=success
curl -i "$SCOPE/boards/$BOARD_ID/drive-uploads" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"files":[{"file_name":"sample.txt","extension":"txt","size":12}],"drive_folder_id":null}'
# 0건은400이 아님: 같은권한검사를거쳐200 []
curl -i "$SCOPE/boards/$BOARD_ID/drive-uploads" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"files":[]}'
# 점붙은확장자는400
curl -i "$SCOPE/boards/$BOARD_ID/drive-uploads" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"files":[{"file_name":"sample.txt","extension":".txt","size":12}]}'
```
[`internal/transport/httpapi/board/driveuploadbody.go:45`](../../internal/transport/httpapi/board/driveuploadbody.go#L45) [`internal/transport/httpapi/board/driveupload_test.go:317`](../../internal/transport/httpapi/board/driveupload_test.go#L317)

## POST /api/v1/board/companies/{company_id}/users/{user_id}/drive-files/{id}/upload-complete

### 1. 경로

OperationID: `board-complete-drive-upload`. [`internal/transport/httpapi/board/routes.go:1155`](../../internal/transport/httpapi/board/routes.go#L1155)

S3 PUT이 끝난 파일을 실측해서 확정. [`internal/transport/httpapi/board/drivecomplete.go:112`](../../internal/transport/httpapi/board/drivecomplete.go#L112)

### 2. Path

company_id/user_id: int64의 정규10진 문자열, 토큰불일치403 FORBIDDEN. id: UUID문자열; Huma형식오류400 INVALID_PAYLOAD. [`internal/transport/httpapi/middleware/auth.go:261`](../../internal/transport/httpapi/middleware/auth.go#L261) [`internal/transport/httpapi/board/drivecomplete.go:25`](../../internal/transport/httpapi/board/drivecomplete.go#L25)

### 3. Query

없음. [`internal/transport/httpapi/board/drivecomplete.go:25`](../../internal/transport/httpapi/board/drivecomplete.go#L25)

### 4. Body

Body 자체 생략/`{}`/JSON `null` 가능. 필수 필드 없음. optional file_id/object_key의 null도 Go 빈 문자열이 되어 무시된다. `internal/transport/httpapi/board/drivecomplete.go:25`, `internal/transport/httpapi/board/drivecomplete.go:41`, [Huma validate.go:855](https://github.com/danielgtaylor/huma/blob/v2.39.0/validate.go#L855)

| 필드 | 타입 | 필수 | 기본 | 상한·동작 |
| --- | --- | --- | --- | --- |
| file_id | string | 아니오 | 빈값 | 길이상한없음, 완전히무시 |
| object_key | string | 아니오 | 빈값 | 길이상한없음, 완전히무시 |
| 다른키 | 임의JSON | 아니오 | 없음 | 허용·무시(전체body1MiB) |

알려진 file_id/object_key에 객체/숫자를 보내는 타입오류는400이다. 서버는 경로id와DB에저장한키만사용한다. [`internal/transport/httpapi/board/drivecomplete.go:25`](../../internal/transport/httpapi/board/drivecomplete.go#L25) [`internal/transport/httpapi/board/drivecomplete.go:52`](../../internal/transport/httpapi/board/drivecomplete.go#L52)

### 5. 인증·권한

board bearer/PathScope/schema→S3미설정503→파일없음/타회사/삭제404→Read AND 업로더 본인(둘 중 하나라도 실패 또는 file.user_id=NULL이면403, 실패 조건 구분 불가)→이미ACT/FAIL이면200현재행→HEAD→객체없음/0byte이면200현재행→CAS UPDATE(경합409). DRIVE타입재검사없음. [`internal/transport/httpapi/board/drivecomplete.go:112`](../../internal/transport/httpapi/board/drivecomplete.go#L112) [`internal/domain/board/drivecomplete.go:136`](../../internal/domain/board/drivecomplete.go#L136)

### 6. Response

| HTTP | 형태/code |
| --- | --- |
| 200 | [DriveFileDTO](09-drive-file.md#drivefiledto) 객체. 성공ACT, 크기초과FAIL, 미업로드/0byteUPLOADING, 이미완료상태그대로 |
| 400 | INVALID_PAYLOAD |
| 401/403/404 | UNAUTHORIZED/FORBIDDEN/NOT_FOUND |
| 409 | UPLOAD_NOT_PENDING(HEAD후 CAS시점경합) |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE |

`UPLOAD_OBJECT_MISSING` 상수는 있어도 현재 실행경로의 객체없음은200이고 이코드를 내지 않는다. [`internal/transport/httpapi/board/drivecomplete.go:140`](../../internal/transport/httpapi/board/drivecomplete.go#L140) [`internal/transport/httpapi/board/drivecomplete.go:206`](../../internal/transport/httpapi/board/drivecomplete.go#L206)

### 7. 주의사항

실제size가파일당상한초과면FAIL을저장하고200. 상태·size·updated_at만바꾸며관계는HEAD전조회결과다. ACT전환때만비동기업로드알림을enqueue, 실패해도응답200은유지. 요청content type/extension검증·악성파일검사동작은이경로에없다. [`internal/domain/board/drivecomplete.go:199`](../../internal/domain/board/drivecomplete.go#L199) [`internal/transport/httpapi/board/drivecomplete.go:172`](../../internal/transport/httpapi/board/drivecomplete.go#L172)

### 8. 시나리오

```bash
# 정상: presign응답의URL에 실제파일업로드; board토큰을S3에보내지않는다
curl -i -X PUT "$UPLOAD_URL" --upload-file "$LOCAL_FILE"
# 위PUT이성공한예약의file_id →200 ACT(파일당상한이내)
curl -i -X POST "$SCOPE/drive-files/$FILE_ID/upload-complete" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{}'
# 이미ACT인같은id:500/409대신200현재행; 다른key도무시
curl -i -X POST "$SCOPE/drive-files/$FILE_ID/upload-complete" -H "Authorization: Bearer $BOARD_TOKEN" -H 'Content-Type: application/json' -d '{"object_key":"ignored","state":"FAIL"}'
# UUID형식오류 →400
curl -i -X POST "$SCOPE/drive-files/not-a-uuid/upload-complete" -H "Authorization: Bearer $BOARD_TOKEN"
```
[`internal/transport/httpapi/board/drivecomplete_test.go:217`](../../internal/transport/httpapi/board/drivecomplete_test.go#L217)

## GET /api/v1/companies/{company_id}/departments

### 1. 경로

OperationID: `list-company-departments`. [`internal/transport/httpapi/management/handler.go:49`](../../internal/transport/httpapi/management/handler.go#L49)

카테고리대상선택에도사용하는회사조직도. [`internal/transport/httpapi/management/handler.go:48`](../../internal/transport/httpapi/management/handler.go#L48)

### 2. Path

company_id: int64, member토큰company_id의정규10진문자열과불일치403 FORBIDDEN. 관리자권한없어도조회가능. [`internal/transport/httpapi/middleware/auth.go:212`](../../internal/transport/httpapi/middleware/auth.go#L212) [`internal/transport/httpapi/management/department.go:15`](../../internal/transport/httpapi/management/department.go#L15)

### 3. Query

| 이름 | 타입 | 필수 | 기본 | 허용/파싱/상한/오류 |
| --- | --- | --- | --- | --- |
| category_id | string | 아니오 | 빈문자열(전체) | 빈값/`0`이면필터없음. 그외uuid.Parse허용UUID, 불량400 INVALID_PAYLOAD; 배열아님, 길이별상한없음 |

[`internal/transport/httpapi/management/department.go:103`](../../internal/transport/httpapi/management/department.go#L103)

### 4. Body

없음. [`internal/transport/httpapi/management/department.go:15`](../../internal/transport/httpapi/management/department.go#L15)

### 5. 인증·권한

member bearer401→company PathScope403→category구문400→타회사살아있는category만404→조직도조회. category관리자검사는없다. 존재하지않는UUID/삭제category는404조건에걸리지않아전체members를돌려줄수있다. [`internal/transport/httpapi/management/department.go:99`](../../internal/transport/httpapi/management/department.go#L99) [`internal/domain/board/departmenttree.go:56`](../../internal/domain/board/departmenttree.go#L56)

### 6. Response

| HTTP | 형태/code |
| --- | --- |
| 200 | [조직도루트](#organizationdto) 하나, 루트없으면빈Body |
| 400 | INVALID_PAYLOAD |
| 401/403 | UNAUTHORIZED/FORBIDDEN |
| 404 | NOT_FOUND(살아있는타회사category) |
| 500/503 | INTERNAL_ERROR/SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/management/department.go:99`](../../internal/transport/httpapi/management/department.go#L99)

### 7. 주의사항

users.status는 필터하지 않는다. category 지정 시 하위 빈 가지는 제거하지만 루트는 인원0이어도 반환한다. `internal/domain/board/departmenttree.go:140`, `internal/domain/board/departmenttree.go:214`

category허용user와부서집합이둘다비어있으면member필터를적용하지않는다. category지정시비어있는하위branch는제거한다. users.deleted_at(퇴직)은소속쿼리에서제외하지않으며 users.disabled_at/members.disabled_at는제외한다. 설정저장/읽음부수효과없음. [`internal/domain/board/departmenttree.go:140`](../../internal/domain/board/departmenttree.go#L140) [`internal/domain/board/departmenttree.go:156`](../../internal/domain/board/departmenttree.go#L156) [`internal/domain/board/departmenttree.go:214`](../../internal/domain/board/departmenttree.go#L214)

### 8. 시나리오

```bash
# 정상:company와일치하는member토큰 →200
curl -i "$BASE_URL/api/v1/companies/$COMPANY_ID/departments" -H "Authorization: Bearer $MEMBER_TOKEN"
# 0은UUID오류가아님:전체조직도
curl -i -G "$BASE_URL/api/v1/companies/$COMPANY_ID/departments" -H "Authorization: Bearer $MEMBER_TOKEN" --data-urlencode 'category_id=0'
# 잘못된UUID는400
curl -i -G "$BASE_URL/api/v1/companies/$COMPANY_ID/departments" -H "Authorization: Bearer $MEMBER_TOKEN" --data-urlencode 'category_id=not-a-uuid'
```
[`internal/transport/httpapi/management/handler_test.go:436`](../../internal/transport/httpapi/management/handler_test.go#L436)

## GET /image/resize/{size}

### 1. 경로

OperationID: `resize-image`. [`internal/transport/httpapi/image/image.go:99`](../../internal/transport/httpapi/image/image.go#L99)

원본스트리밍 또는리사이즈CDN리다이렉트. [`internal/transport/httpapi/image/image.go:97`](../../internal/transport/httpapi/image/image.go#L97)

### 2. Path

size:string 필수. 허용 `s`=235px, `s_m`=500, `m`=640, `l_m`=800, `l`=1024, `o`=원본. 대소문자구별. 잘못된값은 **원본HEAD성공후**400 INVALID_PAYLOAD; 원본없으면404가먼저다. [`internal/transport/httpapi/image/resize.go:24`](../../internal/transport/httpapi/image/resize.go#L24) [`internal/transport/httpapi/image/image.go:182`](../../internal/transport/httpapi/image/image.go#L182)

### 3. Query

| 이름 | 타입 | 필수 | 기본 | 규칙 |
| --- | --- | --- | --- | --- |
| image_url | string | 예 | 없음 | URL이아닌S3키. 길이상한없음. AWS_FOLDER/로시작, `..`포함불가,빈path세그먼트불가→400. 배열아님 |

키는 `--data-urlencode`로 인코딩한다. [`internal/transport/httpapi/image/image.go:119`](../../internal/transport/httpapi/image/image.go#L119) [`internal/platform/objectstore/objectstore.go:251`](../../internal/platform/objectstore/objectstore.go#L251)

### 4. Body

없음. [`internal/transport/httpapi/image/image.go:119`](../../internal/transport/httpapi/image/image.go#L119)

### 5. 인증·권한

exempt, Authorization없음. query검증400→store/prefix/CDN미설정503→key검증400+원본존재404→o이면원본→size검사400→cacheHEAD→cache없으면크기/디코딩→저장→302. 사용자/회사/board권한없다. [`internal/transport/httpapi/image/image.go:177`](../../internal/transport/httpapi/image/image.go#L177)

### 6. Response

| HTTP | 응답필드·헤더 | 타입/null/계산·포맷 |
| --- | --- | --- |
| 200(size=o) | Body | 원본binary, JSON필드/관계없음 |
| 200 | Content-Type | 저장된객체값 또는 application/octet-stream |
| 200 | Content-Length | HEAD크기>0일때10진문자열계산 |
| 302 | Location | CDN_URL/AWS_FOLDER/resize/{size}/{image_url}; 빈Body |
| 400/404 | error | INVALID_PAYLOAD(잘못된 key/size, cache miss의 비이미지·손상 디코딩 포함)/NOT_FOUND |
| 413 | error | REQUEST_ENTITY_TOO_LARGE |
| 500/503 | error | INTERNAL_ERROR/SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/image/image.go:228`](../../internal/transport/httpapi/image/image.go#L228) [`internal/transport/httpapi/image/image.go:308`](../../internal/transport/httpapi/image/image.go#L308)

### 7. 주의사항

높이는 비율 계산 후 버림(최소1px)이고 출력 포맷은 key 확장자가 아닌 실제 디코더 결과로 고른다. 허용 원본 key에도 AWS_FOLDER가 들어 있어 cache Location에서는 이 prefix가 두 번 나타난다. `internal/transport/httpapi/image/image.go:269`, `internal/transport/httpapi/image/resize.go:79`, `internal/transport/httpapi/image/resize.go:105`, `internal/transport/httpapi/image/image.go:199`

리사이즈cachemiss만원본20MiB/40,000,000픽셀제한. 원본HEAD는cachehit에도실행. JPEG는quality90 JPEG, PNG/GIF는PNG(GIF첫프레임); 종횡비유지,작은원본도확대,높이최소1. 앱차원의cache만료/무효화없으므로같은key덮어쓰기시이전리사이즈가남는다. 원본o는스트리밍중오류가나도이미200헤더를바꾸지못한다. [`internal/transport/httpapi/image/resize.go:82`](../../internal/transport/httpapi/image/resize.go#L82) [`internal/transport/httpapi/image/image.go:199`](../../internal/transport/httpapi/image/image.go#L199) [`internal/transport/httpapi/image/image.go:238`](../../internal/transport/httpapi/image/image.go#L238)

### 8. 시나리오

```bash
# 정상원본키:302의Location확인(curl -L이면실제CDN이미지까지다운로드)
curl -i -G "$BASE_URL/image/resize/s" --data-urlencode "image_url=$IMAGE_KEY"
# 같은원본은200 binary
curl -D - -G "$BASE_URL/image/resize/o" --data-urlencode "image_url=$IMAGE_KEY" -o /tmp/board-original-image
# 원본이있을때잘못된size→400
curl -i -G "$BASE_URL/image/resize/xl" --data-urlencode "image_url=$IMAGE_KEY"
# image_url누락→400
curl -i "$BASE_URL/image/resize/s"
```
[`internal/transport/httpapi/image/image_test.go:227`](../../internal/transport/httpapi/image/image_test.go#L227)

## GET /api/v1/client-versions

### 1. 경로

OperationID: `get-client-versions-guest`. [`internal/transport/httpapi/core/clientversion.go:36`](../../internal/transport/httpapi/core/clientversion.go#L36)

플랫폼별최신/최소버전조회. [`internal/transport/httpapi/core/clientversion.go:34`](../../internal/transport/httpapi/core/clientversion.go#L34)

### 2. Path

없음. [`internal/transport/httpapi/core/clientversion.go:70`](../../internal/transport/httpapi/core/clientversion.go#L70)

### 3. Query

| 이름 | 타입 | 필수 | 기본 | 규칙 |
| --- | --- | --- | --- | --- |
| company_id | int64 query | 아니오 | 생략시nil | 명시하면1이상; 배열아님; int64최대외상한없음 |
| user_id | int64 query | 아니오 | 생략시nil | 명시하면1이상; 단독지정가능; 배열아님 |

불량정수/명시0/음수는422 VALIDATION_ERROR. 둘 다 생략 가능하며 `company_id=`/`user_id=`는 미전송(nil)이다. [Huma huma.go:962](https://github.com/danielgtaylor/huma/blob/v2.39.0/huma.go#L962) [`internal/transport/httpapi/core/clientversion.go:70`](../../internal/transport/httpapi/core/clientversion.go#L70)

### 4. Body

없음. [`internal/transport/httpapi/core/clientversion.go:70`](../../internal/transport/httpapi/core/clientversion.go#L70)

### 5. 인증·권한

exempt. 입력422→후보조회500/503→200. query회사의권한·실존체크없음, 토큰없어도입력id로버전조회가능. [`internal/transport/httpapi/core/clientversion.go:75`](../../internal/transport/httpapi/core/clientversion.go#L75)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [플랫폼map](#versiondto), data봉투없음 |
| 422 | VALIDATION_ERROR |
| 500/503 | INTERNAL_ERROR/SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/core/clientversion.go:111`](../../internal/transport/httpapi/core/clientversion.go#L111)

### 7. 주의사항

읽기전용, 읽음·최근검색저장·서버cache없음. 최신과최소를각각다른행에서선택하지않고선택한한행의쌍이다. 표준키와비표준키의선택규칙은공유DTO참조. [`internal/domain/core/clientversion/resolve.go:23`](../../internal/domain/core/clientversion/resolve.go#L23)

### 8. 시나리오

```bash
# 무인증정상;후보가없어도표준9플랫폼0.1.0 →200
curl -i "$BASE_URL/api/v1/client-versions"
# 명시한0은생략이아니다 →422
curl -i -G "$BASE_URL/api/v1/client-versions" --data-urlencode 'company_id=0'
# 양수범위조회 →200(실존검증없음)
curl -i -G "$BASE_URL/api/v1/client-versions" --data-urlencode "company_id=$COMPANY_ID" --data-urlencode "user_id=$USER_ID"
```

[`internal/transport/httpapi/core/clientversion_test.go:1`](../../internal/transport/httpapi/core/clientversion_test.go#L1)

## GET /api/v1/companies/{company_id}/users/{user_id}/client-versions

### 1. 경로

OperationID: `get-client-versions`. [`internal/transport/httpapi/core/clientversion.go:45`](../../internal/transport/httpapi/core/clientversion.go#L45)

플랫폼별최신/최소버전조회. [`internal/transport/httpapi/core/clientversion.go:34`](../../internal/transport/httpapi/core/clientversion.go#L34)

### 2. Path

company_id,user_id:int64,1이상; 토큰정규10진문자열과불일치403 FORBIDDEN. 일치후minimum위반422 VALIDATION_ERROR. [`internal/transport/httpapi/core/clientversion.go:90`](../../internal/transport/httpapi/core/clientversion.go#L90)

### 3. Query

| 이름 | 타입 | 필수 | 기본 | 규칙 |
| --- | --- | --- | --- | --- |
| agent_id | string | 아니오 | 빈값 | 수용하지만완전히무시; 길이상한없음,배열아님 |

[`internal/transport/httpapi/core/clientversion.go:90`](../../internal/transport/httpapi/core/clientversion.go#L90)

### 4. Body

없음. [`internal/transport/httpapi/core/clientversion.go:90`](../../internal/transport/httpapi/core/clientversion.go#L90)

### 5. 인증·권한

member계약. bearer401→PathScope403→Huma path1이상검증422→principal재확인403→후보조회→200. board bearer는401. [`internal/transport/httpapi/core/clientversion.go:96`](../../internal/transport/httpapi/core/clientversion.go#L96)

### 6. Response

| HTTP | 응답 |
| --- | --- |
| 200 | [플랫폼map](#versiondto), data봉투없음 |
| 422 | VALIDATION_ERROR |
| 401/403 | UNAUTHORIZED/FORBIDDEN |
| 500/503 | INTERNAL_ERROR/SERVICE_UNAVAILABLE |

[`internal/transport/httpapi/core/clientversion.go:111`](../../internal/transport/httpapi/core/clientversion.go#L111)

### 7. 주의사항

읽기전용, 읽음·최근검색저장·서버cache없음. 최신과최소를각각다른행에서선택하지않고선택한한행의쌍이다. 표준키와비표준키의선택규칙은공유DTO참조. [`internal/domain/core/clientversion/resolve.go:23`](../../internal/domain/core/clientversion/resolve.go#L23)

### 8. 시나리오

```bash
# 정상member토큰과동일scope →200
curl -i "$BASE_URL/api/v1/companies/$COMPANY_ID/users/$USER_ID/client-versions" -H "Authorization: Bearer $MEMBER_TOKEN"
# 선행0이붙은company:정수로같아도403
curl -i "$BASE_URL/api/v1/companies/0${COMPANY_ID}/users/$USER_ID/client-versions" -H "Authorization: Bearer $MEMBER_TOKEN"
# 헤더없음→401
curl -i "$BASE_URL/api/v1/companies/$COMPANY_ID/users/$USER_ID/client-versions"
```

[`internal/transport/httpapi/core/clientversion_test.go:1`](../../internal/transport/httpapi/core/clientversion_test.go#L1)
