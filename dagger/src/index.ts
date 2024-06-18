import {
    dag,
    Container,
    Directory,
		File,
    object,
    func,
} from "@dagger.io/dagger"

@object()
class legendDaggerizeMinimalMaven {
  /**
   * Returns a container for Legend Engine dev
   */
  @func()
  legendEngine(source: Directory, config: File): Container {
    const ubuntuImage = "ubuntu:jammy-20240530"
    const engineConfig = "/root/.legend/config.yaml"
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
        .withFile(engineConfig, config)
        .withEnvVariable("GITLAB_SERVER", "gitlab.com")
        .withEnvVariable("APP_ID", "app-id-placeholder")
        .withEnvVariable("APP_SECRET", "app-secret-placeholder")
        .withEnvVariable("SDLC_SERVER_HOST" ,"localhost")
        .withExec(["echo", "$GITLAB_SERVER", ">>", "/root/.bashrc"])
        .withExec(["echo", "$APP_ID", ">>", "/root/.bashrc"])
        .withExec(["echo", "$APP_SECRET", ">>", "/root/.bashrc"])
        .withExec(["echo", "$SDLC_SERVER_HOST", ">>", "/root/.bashrc"])
        .withExec(["bash", "-c", "envsubst <" + engineConfig + ">" + engineConfig + ".filled"])
		// .withExec([
        //     "bash",
        //     "-c",
        //     `java -cp \
        //     legend-engine-server/target/*-shaded.jar org.finos.legend.engine.server.Server \
        //     server` + " " + engineConfig + ".filled"
        // ])
    }
}