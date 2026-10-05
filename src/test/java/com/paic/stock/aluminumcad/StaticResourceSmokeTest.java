package com.paic.stock.aluminumcad;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StaticResourceSmokeTest {

    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Test
    void shouldServeEditorAndAllCriticalStaticResources() throws Exception {
        assertResource("/", "铝型材设计器");
        assertResource("/js/app.js", "createApp");
        assertResource("/", "制造汇总");
        assertResource("/js/model/HardwareCatalog.js", "HardwareCatalog");
        assertResource("/js/diy/DiyTemplateCatalog.js", "TURTLE_TANK_RACK");
        assertResource("/js/diy/DiyGenerator.js", "class DiyGenerator");
        assertResource("/api/accessories", "3030-END");
        assertResource("/js/export/BomExporter.js", "buildSubassemblyBomRows");
        assertResource("/js/export/BomExporter.js", "validateConsistency");
        assertResource("/js/model/ProfileFeatureCatalog.js", "getSlotDefinitionsForFace");
        assertResource("/js/model/ProfileCatalogApi.js", "fetchDatabaseProfiles");
        assertResource("/js/model/ProfileSectionEditor.js", "ProfileSectionTemplateOptions");
        assertResource("/js/interaction/ProfileSectionPreview3D.js", "class ProfileSectionPreview3D");
        assertResource("/", "型材目录管理");
        assertResource("/api/profile-catalog?includeDisabled=true", "[");
        assertResource("/js/model/SlotMatcher.js", "matchNearestSlot");
        assertResource("/js/model/ConnectionRuleCatalog.js", "recommendConnectionRules");
        assertResource("/js/connection/ConnectionManager.js", "createRecommendedConnection");
        assertResource("/js/model/DesignConnectionCatalog.js", "DesignConnectionCatalog");
        assertResource("/js/manufacturing/ManufacturingConfigurator.js", "class ManufacturingConfigurator");
        assertResource("/", "制造配置");
        assertResource("/js/constraint/ConstraintManager.js", "RIGID_MATE");
        assertResource("/js/constraint/ConstraintDiagnostics.js", "remainingRigidBodyDof");
        assertResource("/js/constraint/ConstraintResiduals.js");
        assertResource("/js/constraint/ConstraintConflictAnalyzer.js", "expandConflictSet");
        assertResource("/js/constraint/ConstraintMobility.js", "nullSpace3");
        assertResource("/js/constraint/MobilityVisualizer.js", "class MobilityVisualizer");
        assertResource("/js/model/AssemblyManager.js", "installationStep");
        assertResource("/js/model/AssemblyInspector.js", "DISCONNECTED_ASSEMBLY");
        assertResource("/js/model/AssemblyPresentationManager.js", "presentationClone");
        assertResource("/js/machining/MachiningFeatureCatalog.js", "MACHINING_FEATURE_VERSION");
        assertResource("/js/machining/MachiningPatternManager.js", "rectangular");
        assertResource("/js/io/ProjectSchema.js", "CURRENT_PROJECT_SCHEMA_VERSION = 50");
        assertResource("/js/dimension/DimensionSystem.js", "DIMENSION_SYSTEM_VERSION = 2");
        assertResource("/js/drawing/EngineeringDrawingModel.js", "ENGINEERING_DRAWING_MODEL_VERSION = 1");
        assertResource("/js/drawing/EngineeringDrawingLayout.js", "ENGINEERING_DRAWING_LAYOUT_VERSION = 1");
        assertResource("/js/drawing/EngineeringDrawingService.js", "ENGINEERING_DRAWING_SYSTEM_VERSION = 2");
        assertResource("/js/drawing/EngineeringDrawingSvgExporter.js", "title-block");
        assertResource("/js/drawing/EngineeringDrawingDxfExporter.js", "ENGINEERING_DRAWING_DXF_VERSION = 1");
        assertResource("/js/interaction/ProfileGripEditor.js", "class ProfileGripEditor");
        assertResource("/js/interaction/ProfileGripMath.js", "remapMachiningStations");
        assertResource("/js/interaction/FeatureHoverManager.js", "型材 Feature 级预高亮");
        assertResource("/js/interaction/WorkPlaneVisualizer.js", "CAD 工作平面可视化");
        assertResource("/js/interaction/SelectionCycleManager.js", "穿透/循环选择");
        assertResource("/js/validation/PartCollisionDetector.js", "intersectObb");
        assertResource("/js/validation/ConnectionCompletenessInspector.js", "GEOMETRIC_CONTACT_WITHOUT_CONNECTION");
        assertResource("/js/annotation/SceneAnnotationManager.js", "showMachiningDimensions");
        assertResource("/js/annotation/SceneAnnotationManager.js", "screenDeltaToWorld");
        assertResource("/vendor/vue/vue.global.js", "Vue");
        assertResource("/vendor/jszip/jszip.min.js", "JSZip");
        assertResource("/vendor/three/build/three.module.min.js", "WebGLRenderer");
        assertResource("/vendor/three/examples/jsm/controls/OrbitControls.js", "OrbitControls");
        assertResource("/vendor/three/examples/jsm/controls/TransformControls.js", "TransformControls");
        assertResource("/samples/" + encodePathSegment("型材架子_610x670_H2050.json"), "parts");
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private void assertResource(String path, String expectedText) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(), "Unexpected HTTP status for " + path);
        assertTrue(response.body().contains(expectedText), "Expected content was not found in " + path);
    }
}
