/**
 * OpenAPI spec 기반 응답 검증 설정
 *
 * import만으로 Jest에 toSatisfyApiSpec() matcher가 등록된다.
 * 계약 테스트에서 `expect(res).toSatisfyApiSpec()`으로 사용.
 */
import jestOpenAPI from "jest-openapi"
import path from "path"

const specPath = path.join(__dirname, "../../openapi.json")
jestOpenAPI(specPath)
