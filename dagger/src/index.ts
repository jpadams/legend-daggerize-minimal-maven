import {
    dag,
    Container,
    Directory,
    object,
    func,
} from "@dagger.io/dagger"

@object()
class legendDaggerizeMinimalMaven {
    /**
     * Returns Legend Engine Container ready to
     * run as a Service on port 6300
     */
    @func()
    base(source?: Directory, useCachedContainer: boolean=false): Container {
        const ubuntuImage = "ubuntu:jammy-20240530"
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

    @func()
    legendEngine(source?: Directory, useCachedContainer: boolean=false): Container {        
        const ctr = this.base(source, useCachedContainer)
        return ctr.withExec([
            "bash",
            "-c",
            `java -cp \
            java -cp \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/target/legend-engine-server-http-server-*-shaded.jar \
            org.finos.legend.engine.server.Server \
            server \
            legend-engine-config/legend-engine-server/legend-engine-server-http-server/config/config.json`
        ])
        .withExposedPort(6300)
    }
}