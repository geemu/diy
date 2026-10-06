package com.paic.stock.aluminumcad;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

@SpringBootTest
class StaticResourceSmokeTest {

    private final MockMvc mockMvc;

    @Autowired
    StaticResourceSmokeTest(WebApplicationContext applicationContext) {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void shouldServeEditorAndAllCriticalStaticResources() throws Exception {
        assertResource("/index.html", "铝型材设计器");
        assertResource("/js/app.js", "createApp");
        assertResource("/index.html", "制造汇总");
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
        assertResource("/index.html", "型材目录管理");
        assertResource("/api/profile-catalog?includeDisabled=true", "[");
        assertResource("/js/model/SlotMatcher.js", "matchNearestSlot");
        assertResource("/js/model/ConnectionRuleCatalog.js", "recommendConnectionRules");
        assertResource("/js/connection/ConnectionManager.js", "createRecommendedConnection");
        assertResource("/js/model/DesignConnectionCatalog.js", "DesignConnectionCatalog");
        assertResource("/js/manufacturing/ManufacturingConfigurator.js", "class ManufacturingConfigurator");
        assertResource("/index.html", "制造配置");
        assertResource("/js/constraint/ConstraintManager.js", "RIGID_MATE");
        assertResource("/js/constraint/ConstraintDiagnostics.js", "remainingRigidBodyDof");
        assertResource("/js/constraint/ConstraintResiduals.js", "class ConstraintResiduals");
        assertResource("/js/constraint/ConstraintConflictAnalyzer.js", "expandConflictSet");
        assertResource("/js/constraint/ConstraintMobility.js", "nullSpace3");
        assertResource("/js/constraint/MobilityVisualizer.js", "class MobilityVisualizer");
        assertResource("/js/model/AssemblyManager.js", "installationStep");
        assertResource("/js/model/AssemblyInspector.js", "DISCONNECTED_ASSEMBLY");
        assertResource("/js/model/AssemblyPresentationManager.js", "presentationClone");
        assertResource("/js/machining/MachiningFeatureCatalog.js", "MACHINING_FEATURE_VERSION");
        assertResource("/js/machining/MachiningPatternManager.js", "rectangular");
        assertResource("/js/io/ProjectSchema.js", "CURRENT_PROJECT_SCHEMA_VERSION = 62");
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
        assertResource("/samples/型材架子_610x670_H2050.json", "parts");
    }

    /** 浏览器不能仅更新页面版本号却继续使用旧的内部模块。 */
    @Test
    void browserModulesMustRevalidate() throws Exception {
        mockMvc.perform(get("/js/ui/ViewCube.js"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache"));
        mockMvc.perform(get("/css/app.css"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache"));
    }

    private void assertResource(String path, String expectedText) throws Exception {
        MvcResult result = mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andReturn();
        String responseBody = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(responseBody.contains(expectedText), "Expected content was not found in " + path);
    }
}
