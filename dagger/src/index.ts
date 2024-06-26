/**
 * Daggerized minimal Legend config
 */

import {
    dag,
    Container,
    Directory,
	Secret,
    Service,
    object,
    func,
} from "@dagger.io/dagger"

@object()
class legendDaggerizeMinimalMaven {
    /**
     * Legend Engine build
     */
    @func()
    engineBase(source?: Directory, useCachedContainer: boolean=false): Container {
        const ubuntuImage = "ubuntu:jammy-20240530"
        // cache of this portion of the build since it takes several hours on my machine
        const cachedImage = "docker.io/jeremyatdockerhub/legend-engine-poc:latest@sha256:5f2c8256faf99174998c5719c8cd35fa5c8abcbff5022efd9f3162fa56a4cae3"

        if (useCachedContainer === true) {
            return dag.container().from(cachedImage)  
        }
        else if (source === undefined) {
            throw new Error("if `use-cached-container` is `false` then must provide `source`.")
        }
        else {
            return dag
            .container()//{platform: "linux/amd64" as Platform})
            .from(ubuntuImage)
            .withExec([
                "apt",
                "update",
            ])
            .withExec([
                "apt",
                "install",
                "openjdk-11-jdk",
                "maven",
                "curl",
                "gettext-base",
                "-y",
            ])
            // maven deps cache
            // did not seem worth it to cache target dirs as build often broke
            .withMountedCache(
                "/root/.m2/repository",
                dag.cacheVolume("legend-engine-mvn-cache")
            )
            // copy in source - not mounted so we can publish all to registry
            .withDirectory("/src", source)
            // needs 8GB of heap to build locally
            .withEnvVariable("MAVEN_OPTS", "-Xmx8g")
            .withWorkdir("/src")
            .withExec(["mvn", "install", "-DskipTests"])
        }
    }
    /**
     * Legend Engine ready to run on localhost:6300
     */
    @func()
    legendEngine(source?: Directory, useCachedContainer: boolean=false): Container {        
        const ctr = this.engineBase(source, useCachedContainer)
        return ctr.withExec([
            "bash",
            "-c",
            `java -cp \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/target/legend-engine-server-http-server-*-shaded.jar \
            org.finos.legend.engine.server.Server \
            server \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/config/config.json`
        ])
       .withExposedPort(6300)
    }

    /** 
     * Legend SDLC build
     */
	@func()
    sdlcBase(source: Directory): Container {
        const ubuntuImage = "ubuntu:jammy-20240530"

        return dag
        .container()//{platform: "linux/amd64" as Platform})
        .from(ubuntuImage)
        .withExec([
            "apt",
            "update",
        ])
        .withExec([
            "apt",
            "install",
            "openjdk-11-jdk",
            "maven",
            "curl",
            "gettext-base",
            "-y",
        ])
        // maven deps cache
        .withMountedCache(
            "/root/.m2/repository",
            dag.cacheVolume("legend-engine-mvn-cache")
        )
        // copy in source - not mounted so we can publish all to registry
        .withDirectory("/src", source)
        // 2GB of heap works fine. Likely needs less.
        .withEnvVariable("MAVEN_OPTS", "-Xmx2g")
        .withWorkdir("/src")
        .withExec(["mvn", "install", "-DskipTests"])
    }

    /**
     * Legend SDLC ready to run on localhost:6100
     */
    @func()
    legendSdlc(
        source: Directory,
        gitlabHost: string="gitlab.com",
        sdlcServerHost: string="localhost:6100",
        appId: Secret,
        appSecret: Secret,
    ): Container {
        return this.sdlcBase(source)
        .withEnvVariable("GITLAB_HOST", gitlabHost)
        .withEnvVariable("SDLC_SERVER_HOST", sdlcServerHost)
        .withSecretVariable("APP_ID", appId)
        .withSecretVariable("APP_SECRET", appSecret)
        .withExec(["bash", "-c", "envsubst < ./legend-sdlc-server/src/test/resources/config-sample.yaml > ./config.yaml"])
        .withExec([
            "bash",
            "-c",
            `java -cp \
            legend-sdlc-server/target/legend-sdlc-server-*-shaded.jar \
            org.finos.legend.sdlc.server.LegendSDLCServer \
            server \
            config.yaml`
        ])
        .withExposedPort(6100)
        // admin port
        .withExposedPort(6101)      
    }

    /**
     * Legend Studio build
     */ 
    @func()
    studioBase(source: Directory): Container {
        return dag
        .container()
        .from("node:20.15.0")
        .withDirectory("/src", source)
        .withWorkdir("/src")
        .withMountedCache("/src/node_modules", dag.cacheVolume("node-modules"))
        .withMountedCache("/usr/local/share/.cache/yarn", dag.cacheVolume("global-yarn-cache"))
        .withExec(["yarn", "install"])
        .withExec(["yarn", "setup"])
        .withExec(["bash", "-c", "sed -i 's/localhost/0.0.0.0/' packages/legend-application-studio-deployment/studio.config.js"])
    }

    /**
     * Legend Studio ready to run on localhost:9000
     */ 
	@func()
    legendStudio(source: Directory): Container {
        return this.studioBase(source)
        .withExposedPort(9000)
        .withExec(["yarn", "dev"])
    }   

    /**
     * Minimal Legend Engine, Studio, and SDLC using gitlab.com
     */ 
    @func()
    minimal(appId: Secret, appSecret: Secret): Service {
        const engine = this.legendEngine(null, true)
        const sdlc = this.legendSdlc(dag.git("https://github.com/finos/legend-sdlc").branch("master").tree(), "gitlab.com", "localhost", appId, appSecret)
        const studio = this.legendStudio(dag.git("https://github.com/finos/legend-studio").branch("master").tree())
        return dag.proxy()
        .withService(engine.asService(), "engine", 6300, 6300)
        .withService(sdlc.asService(), "sdlc", 6100, 6100)
        .withService(sdlc.asService(), "sdlc-admin", 6101, 6101)
        .withService(studio.asService(), "studio", 9000, 9000)
        .service()
    }
}   