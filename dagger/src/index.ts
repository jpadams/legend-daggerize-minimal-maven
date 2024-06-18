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
    legendEngine(source: Directory): Container {
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
        // did not seem worth it to cache target dirs as build often broke
        .withMountedCache(
            "/root/.m2/repository",
            dag.cacheVolume("legend-engine-mvn-cache")
        )
        // mount source
        .withMountedDirectory("/src", source)
        // needs 8GB of heap to build locally
        .withEnvVariable("MAVEN_OPTS", "-Xmx8192m")
        .withWorkdir("/src")
        .withExec(["mvn", "install", "-DskipTests"])
        .withExec([
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